//! QQ 音乐收藏与相似歌曲接口。
//! 收藏写入使用官网的 zzc / ag-1 请求协议，改编自 jixunmoe/qmweb-sign。
//!
//! Copyright (c) 2024 Jixun Wu. MIT License:
//! Permission is hereby granted, free of charge, to any person obtaining a copy of this software
//! and associated documentation files (the "Software"), to deal in the Software without
//! restriction, including without limitation the rights to use, copy, modify, merge, publish,
//! distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
//! Software is furnished to do so, subject to the following conditions:
//! The above copyright notice and this permission notice shall be included in all copies or
//! substantial portions of the Software.
//! THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
//! INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
//! PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
//! FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
//! OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
//! IN THE SOFTWARE.

use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use aes_gcm::aead::Aead;
use aes_gcm::{Aes128Gcm, KeyInit, Nonce};
use base64::Engine;
use rand::RngExt;
use reqwest::{Client, header};
use serde_json::{Value, json};
use sha1::{Digest, Sha1};

use crate::error::{MusicClientError, MusicClientResult};
use crate::models::{Song, TencentLoginToken};

use super::library;
use super::utils::hash33;

const REQUEST_KEY: [u8; 16] =
    [189, 48, 95, 16, 208, 255, 116, 182, 239, 84, 218, 184, 53, 181, 225, 207];
const RESPONSE_KEY: [u8; 21] =
    [122, 63, 140, 29, 94, 155, 47, 10, 108, 77, 126, 139, 31, 58, 92, 157, 14, 43, 111, 74, 129];
const SCRAMBLE: [u8; 20] =
    [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];

fn error(message: impl Into<String>) -> MusicClientError {
    MusicClientError::TencentAccountApi(message.into())
}

fn sign(body: &str) -> String {
    let hash = hex::encode_upper(Sha1::digest(body.as_bytes()));
    let bytes = hash.as_bytes();
    let pick =
        |indexes: &[usize]| indexes.iter().map(|index| bytes[*index] as char).collect::<String>();
    let scrambled: Vec<u8> = SCRAMBLE
        .iter()
        .enumerate()
        .map(|(index, value)| {
            let pair = &hash[index * 2..index * 2 + 2];
            value ^ u8::from_str_radix(pair, 16).expect("SHA-1 hex")
        })
        .collect();
    let middle: String = base64::engine::general_purpose::STANDARD
        .encode(scrambled)
        .chars()
        .filter(|ch| !matches!(ch, '/' | '\\' | '+' | '='))
        .collect();
    format!(
        "zzc{}{}{}",
        pick(&[23, 14, 6, 36, 16, 7, 19]),
        middle,
        pick(&[16, 1, 32, 12, 19, 27, 8, 5])
    )
    .to_ascii_lowercase()
}

fn comm(token: &TencentLoginToken) -> Value {
    let gt = hash33(&token.music_key);
    json!({
        "uin": token.music_id.to_string(), "format": "json", "ct": 24, "cv": 4747474,
        "authst": token.music_key, "platform": "yqq.json", "g_tk": gt,
        "g_tk_new_20200303": gt, "inCharset": "utf-8", "outCharset": "utf-8",
        "notice": 0, "needNewCode": 1,
    })
}

fn block_data(response: &Value, key: &str, write: bool) -> MusicClientResult<Value> {
    let block = &response[key];
    let data = &block["data"];
    let codes = [
        response["code"].as_i64(),
        block["code"].as_i64(),
        Some(data["code"].as_i64().unwrap_or(0)),
        Some(data["subcode"].as_i64().unwrap_or(0)),
        if write { data["retCode"].as_i64() } else { Some(0) },
    ];
    if let Some(code) = codes.into_iter().find(|code| *code != Some(0)) {
        return Err(error(format!(
            "QQ 音乐接口拒绝请求（{}）",
            code.map_or("响应不完整".to_owned(), |n| n.to_string())
        )));
    }
    Ok(data.clone())
}

async fn read(
    client: &Client,
    token: &TencentLoginToken,
    key: &str,
    module: &str,
    method: &str,
    param: Value,
) -> MusicClientResult<Value> {
    let mut body = json!({ "comm": comm(token) });
    body[key] = json!({ "module": module, "method": method, "param": param });
    let response: Value = client
        .post("https://u.y.qq.com/cgi-bin/musicu.fcg")
        .header(header::COOKIE, token.to_cookie())
        .header(header::REFERER, "https://y.qq.com/")
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    block_data(&response, key, false)
}

async fn write(
    client: &Client,
    token: &TencentLoginToken,
    method: &str,
    song_id: u64,
    song_type: u64,
) -> MusicClientResult<()> {
    let body = json!({ "comm": comm(token), "playlist": {
        "module": "music.musicasset.PlaylistDetailWrite", "method": method,
        "param": { "dirId": 201, "v_songInfo": [{ "songId": song_id, "songType": song_type }] }
    }});
    let body_text = serde_json::to_string(&body).map_err(|e| error(e.to_string()))?;
    let mut iv = [0u8; 12];
    rand::rng().fill(&mut iv);
    let cipher = Aes128Gcm::new_from_slice(&REQUEST_KEY).map_err(|e| error(e.to_string()))?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&iv), body_text.as_bytes())
        .map_err(|e| error(e.to_string()))?;
    let mut packet = Vec::with_capacity(iv.len() + encrypted.len());
    packet.extend_from_slice(&iv);
    packet.extend_from_slice(&encrypted);
    let timestamp =
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis().to_string();
    let response = client
        .post("https://u6.y.qq.com/cgi-bin/musics.fcg")
        .query(&[("_", timestamp), ("encoding", "ag-1".to_owned()), ("sign", sign(&body_text))])
        .header(header::COOKIE, token.to_cookie())
        .header(header::REFERER, "https://y.qq.com/")
        .header(header::CONTENT_TYPE, "text/plain")
        .header(header::ACCEPT, "application/octet-stream")
        .body(base64::engine::general_purpose::STANDARD.encode(packet))
        .send()
        .await?
        .error_for_status()?;
    let bytes = response.bytes().await?;
    let decoded: Vec<u8> = bytes
        .iter()
        .enumerate()
        .map(|(index, byte)| byte ^ RESPONSE_KEY[index % RESPONSE_KEY.len()])
        .collect();
    let decoded = String::from_utf8_lossy(&decoded);
    let json: Value = serde_json::from_str(&decoded)
        .map_err(|e| error(format!("QQ 音乐写入响应无法解析: {e}")))?;
    block_data(&json, "playlist", true)?;
    Ok(())
}

pub(super) async fn liked_status(
    client: &Client,
    ids: &[String],
    token: &TencentLoginToken,
) -> MusicClientResult<Vec<bool>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    if ids.len() > 100
        || ids
            .iter()
            .any(|id| id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_alphanumeric()))
    {
        return Err(error("无效的 QQ 歌曲 ID"));
    }
    let data = read(
        client,
        token,
        "playlist",
        "music.musicasset.SongFavRead",
        "IsSongFanByMid",
        json!({ "v_songMid": ids }),
    )
    .await?;
    ids.iter()
        .map(|id| data["m_fan"][id].as_bool().ok_or_else(|| error("QQ 音乐未返回完整收藏状态")))
        .collect()
}

pub(super) async fn set_liked(
    client: &Client,
    id: &str,
    liked: bool,
    token: &TencentLoginToken,
) -> MusicClientResult<()> {
    if id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err(error("无效的 QQ 歌曲 ID"));
    }
    if liked_status(client, &[id.to_owned()], token).await?[0] == liked {
        return Ok(());
    }
    let detail = read(
        client,
        token,
        "playlist",
        "music.pf_song_detail_svr",
        "get_song_detail_yqq",
        json!({ "song_mid": id }),
    )
    .await?;
    let track = &detail["track_info"];
    let song_id = track["id"]
        .as_u64()
        .filter(|value| *value > 0)
        .ok_or_else(|| error("QQ 歌曲数字 ID 缺失"))?;
    let song_type = track["type"].as_u64().ok_or_else(|| error("QQ 歌曲类型缺失"))?;
    if track["mid"] != id {
        return Err(error("QQ 歌曲身份不匹配"));
    }
    write(client, token, if liked { "AddSonglist" } else { "DelSonglist" }, song_id, song_type)
        .await?;
    if liked_status(client, &[id.to_owned()], token).await?[0] != liked {
        return Err(error("QQ 音乐未确认收藏变更"));
    }
    Ok(())
}

pub(super) async fn similar_songs(client: &Client, song_id: u64) -> MusicClientResult<Vec<Song>> {
    if song_id == 0 {
        return Err(error("无效的 QQ 数字歌曲 ID"));
    }
    let body = json!({
        "comm": { "ct": 24, "cv": 0, "format": "json", "uin": "0" },
        "related": { "module": "music.recommend.TrackRelationServer", "method": "GetSimilarSongs", "param": { "songid": song_id } }
    });
    let response: Value = client
        .post("https://u.y.qq.com/cgi-bin/musicu.fcg")
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let block = &response["related"];
    let data = &block["data"];
    if response["code"].as_i64() != Some(0)
        || block["code"].as_i64() != Some(0)
        || data["retcode"].as_i64().unwrap_or(0) != 0
    {
        return Err(error("QQ 相似歌曲接口暂时不可用"));
    }
    let flat = data["vecSong"].as_array().into_iter().flatten();
    let grouped = data["vecSongNew"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|group| group["songs"].as_array().into_iter().flatten());
    let mut seen = HashSet::new();
    Ok(flat
        .chain(grouped)
        .filter_map(library::song)
        .filter(|song| song.qq_id != Some(song_id) && seen.insert(song.id.clone()))
        .take(15)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_sign_matches_known_vectors() {
        assert_eq!(sign("123"), "zzcec1b555gzqzg7laztguyjl2bu20r6x1w50c55f60");
        assert_eq!(sign("hello world"), "zzcfb3415bc4nfoxmd9uik71mkomtubjfjp141a1cbbcc");
    }
}
