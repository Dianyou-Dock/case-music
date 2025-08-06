use serde::{Deserialize, Serialize};
use reqwest::Client;
use crate::setting::spotify::SpotifyData;
use anyhow::Result;
use crate::spotify::user::UserData;
use crate::spotify::token;
use crate::spotify::cache;

#[derive(Debug, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub images: Option<Vec<Image>>,
    pub tracks: TracksInfo,
    pub owner: Owner,
    pub collaborative: bool,
    pub public: Option<bool>,
    pub snapshot_id: String,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub uri: String,
    #[serde(rename = "type")]
    pub playlist_type: String,
    #[serde(default)]
    pub primary_color: Option<String>,
    #[serde(default)]
    pub followers: Option<Followers>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Image {
    pub url: String,
    pub height: Option<i32>,
    pub width: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TracksInfo {
    pub total: i32,
    pub href: String,
    #[serde(default)]
    pub items: Option<Vec<PlaylistTrackObject>>,
    #[serde(default)]
    pub limit: Option<i32>,
    #[serde(default)]
    pub next: Option<String>,
    #[serde(default)]
    pub offset: Option<i32>,
    #[serde(default)]
    pub previous: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistTrackObject {
    pub added_at: Option<String>,
    pub added_by: Option<User>,
    pub is_local: bool,
    pub track: Option<Track>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub artists: Vec<Artist>,
    pub album: Option<Album>,
    pub duration_ms: i32,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub uri: String,
    #[serde(rename = "type")]
    pub track_type: String,
    #[serde(default)]
    pub available_markets: Option<Vec<String>>,
    #[serde(default)]
    pub disc_number: Option<i32>,
    #[serde(default)]
    pub explicit: Option<bool>,
    #[serde(default)]
    pub external_ids: Option<ExternalIds>,
    #[serde(default)]
    pub is_playable: Option<bool>,
    #[serde(default)]
    pub popularity: Option<i32>,
    #[serde(default)]
    pub preview_url: Option<String>,
    #[serde(default)]
    pub track_number: Option<i32>,
    #[serde(default)]
    pub is_local: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub uri: String,
    #[serde(rename = "type")]
    pub artist_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: String,
    pub name: String,
    pub images: Vec<Image>,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub uri: String,
    #[serde(rename = "type")]
    pub album_type: String,
    #[serde(default)]
    pub total_tracks: Option<i32>,
    #[serde(default)]
    pub available_markets: Option<Vec<String>>,
    #[serde(default)]
    pub release_date: Option<String>,
    #[serde(default)]
    pub release_date_precision: Option<String>,
    #[serde(default)]
    pub restrictions: Option<Restrictions>,
    #[serde(default)]
    pub artists: Option<Vec<Artist>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalUrls {
    pub spotify: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub uri: String,
    #[serde(rename = "type")]
    pub user_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Owner {
    pub id: String,
    pub display_name: Option<String>,
    pub external_urls: Option<ExternalUrls>,
    pub href: Option<String>,
    pub uri: Option<String>,
    #[serde(rename = "type")]
    pub owner_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Followers {
    pub href: Option<String>,
    pub total: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalIds {
    #[serde(default)]
    pub isrc: Option<String>,
    #[serde(default)]
    pub ean: Option<String>,
    #[serde(default)]
    pub upc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restrictions {
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaylistsResponse {
    pub items: Vec<Playlist>,
    pub total: i32,
    pub limit: i32,
    pub offset: i32,
    pub href: String,
    pub next: Option<String>,
    pub previous: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetPlaylistsResponse {
    pub success: bool,
    pub message: String,
    pub playlists: Option<Vec<Playlist>>,
    pub total: Option<i32>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub next: Option<String>,
    pub previous: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetPlaylistResponse {
    pub success: bool,
    pub message: String,
    pub playlist: Option<Playlist>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaylistItemsResponse {
    pub href: String,
    pub limit: i32,
    pub next: Option<String>,
    pub offset: i32,
    pub previous: Option<String>,
    pub total: i32,
    pub items: Vec<PlaylistTrackObject>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetPlaylistItemsResponse {
    pub success: bool,
    pub message: String,
    pub tracks: Option<Vec<PlaylistTrackObject>>,
    pub total: Option<i32>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub next: Option<String>,
    pub previous: Option<String>,
}

async fn fetch_current_user_playlists(token: &str, limit: Option<i32>, offset: Option<i32>) -> Result<PlaylistsResponse> {
    let client = Client::new();
    let mut request = client
        .get("https://api.spotify.com/v1/me/playlists")
        .header("Authorization", format!("Bearer {}", token));
    
    // 添加分页参数
    if let Some(limit_value) = limit {
        request = request.query(&[("limit", limit_value)]);
    }
    
    if let Some(offset_value) = offset {
        request = request.query(&[("offset", offset_value)]);
    }
    
    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Spotify API错误: {} - {}", status, error_text));
    }

    // 先获取响应文本
    let text = response.text().await?;

    // 解析JSON
    let playlists = match serde_json::from_str::<PlaylistsResponse>(&text) {
        Ok(p) => p,
        Err(e) => {
            println!("JSON解析错误: {}", e);
            return Err(anyhow::anyhow!("解析响应失败: {}", e));
        }
    };
    
    Ok(playlists)
}

async fn fetch_user_playlists(token: &str, user_id: &str, limit: Option<i32>, offset: Option<i32>) -> Result<PlaylistsResponse> {
    let client = Client::new();
    let mut request = client
        .get(&format!("https://api.spotify.com/v1/users/{}/playlists", user_id))
        .header("Authorization", format!("Bearer {}", token));
    
    // 添加分页参数
    if let Some(limit_value) = limit {
        request = request.query(&[("limit", limit_value)]);
    }
    
    if let Some(offset_value) = offset {
        request = request.query(&[("offset", offset_value)]);
    }
    
    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Spotify API错误: {} - {}", status, error_text));
    }

    // 先获取响应文本
    let text = response.text().await?;

    // 解析JSON
    let playlists = match serde_json::from_str::<PlaylistsResponse>(&text) {
        Ok(p) => p,
        Err(e) => {
            println!("JSON解析错误: {}", e);
            return Err(anyhow::anyhow!("解析响应失败: {}", e));
        }
    };

    Ok(playlists)
}

async fn fetch_playlist(token: &str, playlist_id: &str, market: Option<&str>) -> Result<Playlist> {
    let client = Client::new();
    let mut request = client
        .get(&format!("https://api.spotify.com/v1/playlists/{}", playlist_id))
        .header("Authorization", format!("Bearer {}", token));
    
    // 添加市场参数（如果提供）
    if let Some(market_value) = market {
        request = request.query(&[("market", market_value)]);
    }
    
    // 添加fields参数，请求完整的播放列表数据
    // 根据Spotify API文档，可以指定返回的字段，这里我们请求所有相关字段
    let fields = "collaborative,description,external_urls,followers,href,id,images,name,owner,public,snapshot_id,tracks,type,uri";
    request = request.query(&[("fields", fields)]);
    
    // 添加additional_types参数，确保能获取到track类型
    request = request.query(&[("additional_types", "track")]);
    
    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Spotify API错误: {} - {}", status, error_text));
    }

    // 先获取响应文本
    let text = response.text().await?;

    // 解析JSON
    let playlist = match serde_json::from_str::<Playlist>(&text) {
        Ok(p) => p,
        Err(e) => {
            println!("JSON解析错误: {}", e);
            return Err(anyhow::anyhow!("解析响应失败: {}", e));
        }
    };
    
    Ok(playlist)
}

async fn fetch_playlist_items(
    token: &str, 
    playlist_id: &str, 
    market: Option<&str>,
    limit: Option<i32>,
    offset: Option<i32>
) -> Result<PlaylistItemsResponse> {
    let client = Client::new();
    let mut request = client
        .get(&format!("https://api.spotify.com/v1/playlists/{}/tracks", playlist_id))
        .header("Authorization", format!("Bearer {}", token));
    
    // 添加查询参数
    let mut query_params = Vec::new();
    let mut limit_string = String::new();
    let mut offset_string = String::new();
    
    if let Some(market_value) = market {
        query_params.push(("market", market_value));
    }
    
    if let Some(limit_value) = limit {
        limit_string = limit_value.to_string();
        query_params.push(("limit", &limit_string));
    }
    
    if let Some(offset_value) = offset {
        offset_string = offset_value.to_string();
        query_params.push(("offset", &offset_string));
    }
    
    // 添加additional_types参数，确保能获取到track类型
    query_params.push(("additional_types", "track"));
    
    if !query_params.is_empty() {
        request = request.query(&query_params);
    }
    
    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Spotify API错误: {} - {}", status, error_text));
    }

    // 先获取响应文本
    let text = response.text().await?;

    // 解析JSON
    let playlist_items = match serde_json::from_str::<PlaylistItemsResponse>(&text) {
        Ok(items) => items,
        Err(e) => {
            println!("JSON解析错误: {}", e);
            return Err(anyhow::anyhow!("解析响应失败: {}", e));
        }
    };

    Ok(playlist_items)
}

#[tauri::command]
pub async fn get_spotify_playlists(limit: Option<i32>, offset: Option<i32>) -> tauri::Result<GetPlaylistsResponse> {
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(GetPlaylistsResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
                playlists: None,
                total: None,
                limit: None,
                offset: None,
                next: None,
                previous: None,
            });
        }
    };

    // 获取当前用户的歌单
    match fetch_current_user_playlists(&token, limit, offset).await {
        Ok(response) => Ok(GetPlaylistsResponse {
            success: true,
            message: "成功获取歌单".to_string(),
            playlists: Some(response.items),
            total: Some(response.total),
            limit: Some(response.limit),
            offset: Some(response.offset),
            next: response.next,
            previous: response.previous,
        }),
        Err(e) => Ok(GetPlaylistsResponse {
            success: false,
            message: format!("获取歌单失败: {}", e),
            playlists: None,
            total: None,
            limit: None,
            offset: None,
            next: None,
            previous: None,
        }),
    }
}

#[tauri::command]
pub async fn get_user_spotify_playlists(limit: Option<i32>, offset: Option<i32>) -> tauri::Result<GetPlaylistsResponse> {
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(GetPlaylistsResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
                playlists: None,
                total: None,
                limit: None,
                offset: None,
                next: None,
                previous: None,
            });
        }
    };

    // 从spotify_user_data.toml文件获取用户ID
    let user_data = match UserData::load_from_file() {
        Ok(data) => data,
        Err(e) => {
            return Ok(GetPlaylistsResponse {
                success: false,
                message: format!("无法加载用户数据: {}", e),
                playlists: None,
                total: None,
                limit: None,
                offset: None,
                next: None,
                previous: None,
            });
        }
    };

    let user_id = user_data.profile.id;

    // 获取指定用户的歌单
    match fetch_user_playlists(&token, &user_id, limit, offset).await {
        Ok(response) => Ok(GetPlaylistsResponse {
            success: true,
            message: format!("成功获取用户 {} 的歌单", user_id),
            playlists: Some(response.items),
            total: Some(response.total),
            limit: Some(response.limit),
            offset: Some(response.offset),
            next: response.next,
            previous: response.previous,
        }),
        Err(e) => Ok(GetPlaylistsResponse {
            success: false,
            message: format!("获取用户歌单失败: {}", e),
            playlists: None,
            total: None,
            limit: None,
            offset: None,
            next: None,
            previous: None,
        }),
    }
}

#[tauri::command]
pub async fn get_spotify_playlist(playlist_id: String, market: Option<String>) -> tauri::Result<GetPlaylistResponse> {
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(GetPlaylistResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
                playlist: None,
            });
        }
    };

    // 获取单个歌单
    match fetch_playlist(&token, &playlist_id, market.as_deref()).await {
        Ok(playlist) => Ok(GetPlaylistResponse {
            success: true,
            message: "成功获取歌单详情".to_string(),
            playlist: Some(playlist),
        }),
        Err(e) => Ok(GetPlaylistResponse {
            success: false,
            message: format!("获取歌单详情失败: {}", e),
            playlist: None,
        }),
    }
}

#[tauri::command]
pub async fn get_spotify_playlist_items(
    playlist_id: String,
    market: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>
) -> tauri::Result<GetPlaylistItemsResponse> {
    // 设置合理的默认分页参数
    let page_limit = limit.unwrap_or(20).min(50); // 限制最大为50，避免单次请求过大
    let page_offset = offset.unwrap_or(0);

    // 简化缓存键，避免过长
    let cache_key = format!("p_{}_{}_{}_{}", 
        playlist_id.chars().take(11).collect::<String>(), // 只取playlist_id的前11位
        page_offset, 
        page_limit,
        market.as_deref().unwrap_or("default")
    );
    
    // 首先检查缓存（只检查当前页的缓存）
    match cache::get_playlist_items_cache(&cache_key) {
        Ok(Some(cached)) => {
            let page_number = if page_limit > 0 { page_offset / page_limit + 1 } else { 1 };
            println!("🎯 从缓存返回播放列表 {} 的第 {} 页数据 ({} 首歌曲)", 
                playlist_id, page_number, cached.items.len());
            return Ok(GetPlaylistItemsResponse {
                success: true,
                message: "从缓存获取播放列表歌曲".to_string(),
                tracks: Some(cached.items),
                total: Some(cached.total),
                limit: Some(page_limit),
                offset: Some(page_offset),
                next: if (page_offset + page_limit) < cached.total { 
                    Some(format!("offset={}", page_offset + page_limit)) 
                } else { 
                    None 
                },
                previous: if page_offset > 0 { 
                    Some(format!("offset={}", std::cmp::max(0, page_offset - page_limit))) 
                } else { 
                    None 
                },
            });
        },
        Ok(None) => {
            let page_number = if page_limit > 0 { page_offset / page_limit + 1 } else { 1 };
            println!("💾 缓存中没有播放列表 {} 第 {} 页的数据，从Spotify API获取", playlist_id, page_number);
        },
        Err(e) => {
            println!("⚠️ 检查缓存失败: {}, 继续从API获取", e);
        }
    }

    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(GetPlaylistItemsResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
                tracks: None,
                total: None,
                limit: None,
                offset: None,
                next: None,
                previous: None,
            });
        }
    };

    // 只获取当前页的数据
    match fetch_playlist_items(&token, &playlist_id, market.as_deref(), Some(page_limit), Some(page_offset)).await {
        Ok(response) => {
            let page_number = if page_limit > 0 { page_offset / page_limit + 1 } else { 1 };
            println!("✅ 从Spotify API获取播放列表 {} 第 {} 页数据 ({} 首歌曲 / 总计 {} 首)", 
                playlist_id, page_number, response.items.len(), response.total);
                
            // 缓存当前页数据
            if let Err(e) = cache::set_playlist_items_cache(&cache_key, response.items.clone(), response.total) {
                println!("⚠️ 缓存播放列表页面数据失败: {}", e);
            }
            
            Ok(GetPlaylistItemsResponse {
                success: true,
                message: format!("成功获取播放列表第 {} 页歌曲 ({} 首)", page_number, response.items.len()),
                tracks: Some(response.items),
                total: Some(response.total),
                limit: Some(page_limit),
                offset: Some(page_offset),
                next: response.next,
                previous: response.previous,
            })
        },
        Err(e) => Ok(GetPlaylistItemsResponse {
            success: false,
            message: format!("获取播放列表歌曲失败: {}", e),
            tracks: None,
            total: None,
            limit: None,
            offset: None,
            next: None,
            previous: None,
        }),
    }
} 