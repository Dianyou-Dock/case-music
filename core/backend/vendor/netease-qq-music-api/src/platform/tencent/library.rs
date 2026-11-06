//! QQ 音乐账号歌单接口。
use std::collections::HashSet;

use reqwest::{Client, header};
use serde_json::{Value, json};

use crate::error::{MusicClientError, MusicClientResult};
use crate::models::{
    PlaylistDetailResult, Song, SongAlbum, SongArtist, TencentLoginToken, TencentUserPlaylist,
    TencentUserPlaylists,
};

fn value<'a>(item: &'a Value, keys: &[&str]) -> &'a Value {
    keys.iter().find_map(|key| item.get(*key).filter(|v| !v.is_null())).unwrap_or(&Value::Null)
}

fn text(item: &Value) -> String {
    item.as_str()
        .map(str::to_owned)
        .or_else(|| item.as_u64().map(|v| v.to_string()))
        .unwrap_or_default()
}

fn picture(item: &Value) -> String {
    let raw = text(item);
    if raw.starts_with("//") {
        format!("https:{raw}")
    } else if raw.starts_with("https://") || raw.starts_with("http://") {
        raw
    } else {
        String::new()
    }
}

pub(super) fn song(item: &Value) -> Option<Song> {
    let nested = value(item, &["track_info", "track", "songInfo", "songinfo", "song"]);
    let track = if nested.is_object() { nested } else { item };
    let id = text(value(track, &["mid", "songmid"]));
    if id.is_empty() {
        return None;
    }
    let album = &track["album"];
    let album_id = text(value(album, &["mid", "pmid"]));
    let artists = value(track, &["singer", "singers"])
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(|artist| SongArtist {
                    id: text(value(artist, &["mid", "id"])),
                    name: text(value(artist, &["name", "title"])),
                })
                .collect()
        })
        .unwrap_or_default();
    Some(Song {
        id,
        qq_id: value(track, &["id", "songid"]).as_u64(),
        media_mid: {
            let mid = text(value(&track["file"], &["media_mid", "mediaMid"]));
            if mid.is_empty() { None } else { Some(mid) }
        },
        duration_ms: value(track, &["interval", "duration"]).as_u64().unwrap_or(0) * 1000,
        release_date: text(value(track, &["time_public", "timePublic"])),
        name: text(value(track, &["name", "songname", "title"])),
        pic_url: if album_id.is_empty() {
            String::new()
        } else {
            format!("https://y.qq.com/music/photo_new/T002R300x300M000{album_id}.jpg")
        },
        artists,
        album: SongAlbum { id: album_id, name: text(value(album, &["name", "title"])) },
    })
}

fn account_error(message: impl Into<String>) -> MusicClientError {
    MusicClientError::TencentAccountApi(message.into())
}

async fn get(
    client: &Client,
    url: &str,
    params: &[(&str, String)],
    token: &TencentLoginToken,
) -> MusicClientResult<Value> {
    client
        .get(url)
        .query(params)
        .header(header::COOKIE, token.to_cookie())
        .header(header::REFERER, "https://y.qq.com/portal/profile.html")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .map_err(Into::into)
}

fn playlist_items(response: &Value, key: &str) -> MusicClientResult<Vec<Value>> {
    if response["code"].as_i64().unwrap_or(0) != 0 {
        return Err(account_error(format!("response code: {}", response["code"])));
    }
    response["data"][key]
        .as_array()
        .cloned()
        .ok_or_else(|| account_error("invalid playlist list response"))
}

pub(super) async fn user_playlists(
    client: &Client,
    token: &TencentLoginToken,
) -> MusicClientResult<TencentUserPlaylists> {
    let uin = token.music_id.to_string();
    let created = get(
        client,
        "https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss",
        &[
            ("hostUin", "0".into()),
            ("hostuin", uin.clone()),
            ("sin", "0".into()),
            ("size", "200".into()),
            ("g_tk", "5381".into()),
            ("loginUin", uin.clone()),
            ("format", "json".into()),
            ("platform", "yqq.json".into()),
        ],
        token,
    )
    .await?;
    let collected = get(
        client,
        "https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg",
        &[
            ("ct", "20".into()),
            ("cid", "205360956".into()),
            ("userid", uin),
            ("reqtype", "3".into()),
            ("sin", "0".into()),
            ("ein", "80".into()),
        ],
        token,
    )
    .await?;
    let mut playlists = Vec::new();
    let mut seen = HashSet::new();
    for (items, kind) in [
        (playlist_items(&created, "disslist")?, "created"),
        (playlist_items(&collected, "cdlist")?, "collected"),
    ] {
        for item in items {
            let liked = kind == "created" && text(value(&item, &["dirid", "dirId"])) == "201";
            let id = if liked {
                "qq-liked:201".to_owned()
            } else {
                text(value(&item, &["dissid", "tid", "id", "diss_id"]))
            };
            let name = text(value(&item, &["diss_name", "dissname", "name", "title"]));
            if id.is_empty() || name.is_empty() || !seen.insert(id.clone()) {
                continue;
            }
            playlists.push(TencentUserPlaylist {
                id,
                name,
                pic_url: picture(value(&item, &["diss_cover", "logo", "picurl", "cover"])),
                kind: kind.to_owned(),
            });
        }
    }
    if !seen.contains("qq-liked:201") {
        playlists.insert(
            0,
            TencentUserPlaylist {
                id: "qq-liked:201".into(),
                name: "我喜欢".into(),
                pic_url: String::new(),
                kind: "liked".into(),
            },
        );
    }
    playlists.sort_by_key(|item| item.id != "qq-liked:201");
    Ok(TencentUserPlaylists { playlists })
}

async fn diss_page(
    client: &Client,
    id: &str,
    offset: usize,
    token: &TencentLoginToken,
) -> MusicClientResult<Value> {
    let liked = id == "qq-liked:201";
    let numeric_id = if liked {
        0
    } else {
        id.parse::<u64>().map_err(|_| MusicClientError::InvalidIdFormat(id.to_owned()))?
    };
    let body = json!({
        "comm": { "uin": token.music_id.to_string(), "format": "json", "ct": 19, "cv": 0, "authst": token.music_key },
        "playlist": { "module": "music.srfDissInfo.DissInfo", "method": "CgiGetDiss", "param": {
            "disstid": numeric_id, "dirid": if liked { 201 } else { 0 }, "tag": true,
            "song_begin": offset, "song_num": 100, "userinfo": true, "orderlist": true, "onlysonglist": false,
        }}
    });
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
    let block = &response["playlist"];
    if response["code"].as_i64().unwrap_or(0) != 0
        || block["code"].as_i64().unwrap_or(0) != 0
        || !block["data"]["songlist"].is_array()
    {
        return Err(account_error(format!(
            "invalid playlist detail response: code {} / {}",
            response["code"], block["code"]
        )));
    }
    Ok(block["data"].clone())
}

pub(super) async fn user_playlist(
    client: &Client,
    id: &str,
    token: &TencentLoginToken,
) -> MusicClientResult<PlaylistDetailResult> {
    let mut songs = Vec::new();
    let mut seen = HashSet::new();
    let mut name = if id == "qq-liked:201" { "我喜欢".to_owned() } else { String::new() };
    let mut pic_url = String::new();
    let mut description = String::new();
    for page in 0..100 {
        let offset = page * 100;
        let data = diss_page(client, id, offset, token).await?;
        if page == 0 {
            let info = &data["dirinfo"];
            let title = text(value(info, &["title", "name", "dissname", "diss_name"]));
            if !title.is_empty() {
                name = title;
            }
            pic_url = picture(value(info, &["logo", "diss_cover", "cover"]));
            description = text(value(info, &["desc", "description"]));
        }
        let items = data["songlist"].as_array().expect("validated songlist");
        for item in items {
            if let Some(track) = song(item) {
                if seen.insert(track.id.clone()) {
                    songs.push(track);
                }
            }
        }
        let total = data["total_song_num"].as_u64().or_else(|| data["songlist_size"].as_u64());
        let more = data["hasmore"]
            .as_bool()
            .or_else(|| data["hasmore"].as_u64().map(|v| v > 0))
            .unwrap_or_else(|| {
                total.map(|v| offset + items.len() < v as usize).unwrap_or(items.len() == 100)
            });
        if !more || items.is_empty() {
            break;
        }
    }
    Ok(PlaylistDetailResult { id: id.to_owned(), name, pic_url, description, songs })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_song_from_account_playlist() {
        let raw = json!({ "track_info": { "mid": "song-mid", "name": "歌曲", "singer": [{ "mid": "artist-mid", "name": "歌手" }], "album": { "mid": "album-mid", "name": "专辑" } } });
        let result = song(&raw).unwrap();
        assert_eq!(result.id, "song-mid");
        assert_eq!(result.artists[0].name, "歌手");
        assert_eq!(result.album.id, "album-mid");
    }
}
