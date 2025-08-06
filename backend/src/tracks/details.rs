use reqwest::Client;
use crate::spotify::token;
use anyhow::Result;
use crate::tracks::models::{Track, GetTrackResponse};
use crate::artists::models::ExternalUrls;
use crate::album::models::ExternalIds;
use serde::{Deserialize, Serialize};

// 获取单首歌曲的详细信息
pub async fn fetch_track_details(token: &str, track_id: &str, market: Option<&str>) -> Result<Track> {
    let client = Client::new();
    let mut request = client
        .get(&format!("https://api.spotify.com/v1/tracks/{}", track_id))
        .header("Authorization", format!("Bearer {}", token));
    
    // 添加市场参数（如果提供）
    if let Some(market_value) = market {
        request = request.query(&[("market", market_value)]);
    }
    
    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Spotify API错误: {} - {}", status, error_text));
    }

    // 获取响应文本
    let text = response.text().await?;

    // 解析JSON
    let track = match serde_json::from_str::<Track>(&text) {
        Ok(p) => p,
        Err(e) => {
            println!("JSON解析错误: {}", e);
            println!("响应内容: {}", text);
            return Err(anyhow::anyhow!("解析响应失败: {}", e));
        }
    };
    
    Ok(track)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayableTrack {
    pub id: String,
    pub title: String,
    pub artists: Vec<crate::artists::models::Artist>,
    pub artist: String,
    pub url: Option<String>,
    pub album: crate::album::models::Album,
    pub cover: Option<String>,
    pub duration_ms: i32,
    pub has_preview: bool,
    pub href: String,
    pub external_url: String,
    pub web_url: String,
    pub album_name: String,
    pub release_date: String,
    pub explicit: bool,
    pub popularity: i32,
    pub uri: String,
    pub track_number: i32,
    pub disc_number: i32,
    pub is_local: bool,
    pub artist_id: String,
    pub album_id: String,
    pub liked: bool,
}

// 获取歌曲详情并返回可播放信息的命令
#[tauri::command]
pub async fn get_track_details(track_id: String, market: Option<String>) -> tauri::Result<GetTrackResponse> {
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(GetTrackResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
                track: None,
                playable_track: None,
            });
        }
    };

    // 获取歌曲详情
    match fetch_track_details(&token, &track_id, market.as_deref()).await {
        Ok(mut track) => {
            // 检查歌曲是否在SAVED_TRACKS_CACHE中
            let liked = {
                use crate::tracks::likes::SAVED_TRACKS_CACHE;
                let cache = SAVED_TRACKS_CACHE.lock().await;
                cache.contains_key(&track.id)
            };
            
            // 设置liked字段
            track.liked = liked;
            
            // 构建可播放的曲目信息
            let artists_names = track.artists.iter()
                .map(|artist| artist.name.clone())
                .collect::<Vec<String>>()
                .join(", ");
            
            let artist_id = if let Some(artist) = track.artists.first() {
                artist.id.clone()
            } else {
                String::new()
            };
            
            let cover_url = if let Some(images) = &track.album.images.first() {
                Some(images.url.clone())
            } else {
                None
            };
            
            let has_preview = track.preview_url.is_some();
            
            let playable_track = PlayableTrack {
                id: track.id.clone(),
                title: track.name.clone(),
                artists: track.artists.clone(),
                artist: artists_names,
                url: track.preview_url.clone(),
                album: track.album.clone(),
                cover: cover_url,
                duration_ms: track.duration_ms,
                has_preview,
                href: track.href.clone(),
                external_url: track.external_urls.spotify.clone(),
                web_url: track.external_urls.spotify.clone(),
                album_name: track.album.name.clone(),
                release_date: track.album.release_date.clone(),
                explicit: track.explicit,
                popularity: track.popularity,
                uri: track.uri.clone(),
                track_number: track.track_number,
                disc_number: track.disc_number,
                is_local: track.is_local,
                artist_id,
                album_id: track.album.id.clone(),
                liked: track.liked,
            };
            
            Ok(GetTrackResponse {
                success: true,
                message: "成功获取歌曲详情".to_string(),
                track: Some(track),
                playable_track: Some(playable_track),
            })
        },
        Err(e) => Ok(GetTrackResponse {
            success: false,
            message: format!("获取歌曲详情失败: {}", e),
            track: None,
            playable_track: None,
        }),
    }
} 