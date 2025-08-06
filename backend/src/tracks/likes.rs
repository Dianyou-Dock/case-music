use reqwest::Client;
use crate::setting::spotify::SpotifyData;
use anyhow::Result;
use crate::tracks::models;
use crate::spotify::token;
use std::collections::BTreeMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

// 全局缓存：存储所有收藏的歌曲，使用BTreeMap保持有序
pub static SAVED_TRACKS_CACHE: Lazy<Arc<Mutex<BTreeMap<String, models::Track>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(BTreeMap::new())));
static CACHE_LOADED: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

// sled数据库实例
static LIKES_DB: OnceLock<sled::Db> = OnceLock::new();

// 用于存储在sled数据库中的收藏歌曲数据结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CachedSavedTracks {
    pub tracks: BTreeMap<String, models::Track>,
    pub cached_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

impl CachedSavedTracks {
    pub fn new(tracks: BTreeMap<String, models::Track>) -> Self {
        let now = chrono::Utc::now();
        Self {
            tracks,
            cached_at: now,
            expires_at: now + chrono::Duration::hours(24), // 缓存24小时
        }
    }

    pub fn is_expired(&self) -> bool {
        chrono::Utc::now() > self.expires_at
    }
}

/// 初始化收藏歌曲数据库
pub fn init_likes_db() -> Result<()> {
    let config_dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("无法获取用户主目录"))?
        .join(".malefooo");

    // 确保配置目录存在
    std::fs::create_dir_all(&config_dir)?;
    
    // 数据库文件
    let db_path = config_dir.join("saved_tracks.db");
    if !db_path.exists() {
        println!("🆕 创建新的收藏歌曲数据库: {:?}", db_path);
    } else {
        println!("📂 加载现有收藏歌曲数据库: {:?}", db_path);
    }
    
    // 初始化数据库连接
    let db = sled::open(&db_path)
        .map_err(|e| anyhow::anyhow!("初始化收藏歌曲数据库失败: {}", e))?;
    
    // 设置到全局变量
    LIKES_DB.set(db).map_err(|_| anyhow::anyhow!("收藏歌曲数据库已经被初始化"))?;
    
    println!("✅ 收藏歌曲数据库初始化完成");
    Ok(())
}

fn get_likes_db() -> Result<&'static sled::Db> {
    LIKES_DB.get().ok_or_else(|| anyhow::anyhow!("收藏歌曲数据库未初始化，请确保在程序启动时调用了 init_likes_db()"))
}

// 从sled数据库获取收藏歌曲缓存
async fn get_saved_tracks_from_sled() -> Result<Option<BTreeMap<String, models::Track>>> {
    let db = get_likes_db()?;
    
    match db.get("saved_tracks")? {
        Some(data) => {
            let cached: CachedSavedTracks = bincode::deserialize(&data)?;
            if !cached.is_expired() {
                println!("💾 从sled数据库加载 {} 首收藏歌曲", cached.tracks.len());
                Ok(Some(cached.tracks))
            } else {
                println!("⏰ sled数据库中的收藏歌曲缓存已过期");
                Ok(None)
            }
        },
        None => {
            println!("📭 sled数据库中没有收藏歌曲缓存");
            Ok(None)
        }
    }
}

// 保存收藏歌曲到sled数据库
async fn save_tracks_to_sled(tracks: &BTreeMap<String, models::Track>) -> Result<()> {
    let db = get_likes_db()?;
    let cached = CachedSavedTracks::new(tracks.clone());
    let serialized = bincode::serialize(&cached)?;
    
    db.insert("saved_tracks", serialized)?;
    db.flush()?;
    
    println!("💾 已保存 {} 首收藏歌曲到sled数据库", tracks.len());
    Ok(())
}

// 获取所有收藏歌曲并存储到缓存中
async fn load_all_saved_tracks_to_cache(token: &str) -> Result<()> {
    let mut all_tracks = Vec::new();
    let mut offset = 0;
    let limit = 50; // Spotify API 最大限制
    
    println!("🌐 从Spotify API获取收藏歌曲...");
    
    loop {
        let response = fetch_saved_tracks_from_api(token, Some(limit), Some(offset), None).await?;
        
        // 检查是否有更多数据（在移动 items 之前）
        let has_more = response.next.is_some() && !response.items.is_empty();
        
        all_tracks.extend(response.items);
        
        // 如果没有更多数据，退出循环
        if !has_more {
            break;
        }
        
        offset += limit;
    }
    
    // 创建BTreeMap存储歌曲
    let mut tracks_map = BTreeMap::new();
    for saved_track in all_tracks {
        let mut track = saved_track.track;
        // 在SAVED_TRACKS_CACHE中的所有track的liked都设置为true
        track.liked = true;
        tracks_map.insert(track.id.clone(), track);
    }
    
    // 保存到sled数据库
    if let Err(e) = save_tracks_to_sled(&tracks_map).await {
        println!("⚠️ 保存到sled数据库失败: {}", e);
    }
    
    // 将所有歌曲存储到内存缓存中
    let mut cache = SAVED_TRACKS_CACHE.lock().await;
    cache.clear(); // 清空现有缓存
    *cache = tracks_map;
    
    // 标记缓存已加载
    let mut loaded = CACHE_LOADED.lock().await;
    *loaded = true;
    
    println!("✅ 已缓存 {} 首收藏歌曲到内存", cache.len());
    Ok(())
}

// 从缓存中获取所有数据（一次性返回全部）
async fn get_all_tracks_from_cache() -> models::SavedTracksResponse {
    let cache = SAVED_TRACKS_CACHE.lock().await;
    let all_tracks: Vec<_> = cache.values().cloned().collect();
    
    let total = all_tracks.len() as i32;
    let items: Vec<models::SavedTrack> = all_tracks.iter().map(|track| models::SavedTrack {
        added_at: "".to_string(), // 缓存中没有保存这个信息，可以留空或添加时间戳
        track: track.clone(),
    }).collect();
    
    models::SavedTracksResponse {
        href: "cached".to_string(),
        limit: total, // 返回全部数据时，limit 等于 total
        next: None,   // 没有下一页，因为返回了全部数据
        offset: 0,    // 从第一首歌开始
        previous: None, // 没有上一页
        total,
        items,
    }
}

// 从缓存中获取分页数据
async fn get_tracks_from_cache(limit: Option<i32>, offset: Option<i32>) -> models::SavedTracksResponse {
    let cache = SAVED_TRACKS_CACHE.lock().await;
    let all_tracks: Vec<_> = cache.values().cloned().collect();
    
    let total = all_tracks.len() as i32;
    let offset_val = offset.unwrap_or(0);
    let limit_val = limit.unwrap_or(20).min(50); // 限制最大值为50
    
    let start = offset_val as usize;
    let end = ((offset_val + limit_val) as usize).min(all_tracks.len());
    
    let items: Vec<models::SavedTrack> = if start < all_tracks.len() {
        all_tracks[start..end].iter().map(|track| models::SavedTrack {
            added_at: "".to_string(), // 缓存中没有保存这个信息，可以留空或添加时间戳
            track: track.clone(),
        }).collect()
    } else {
        Vec::new()
    };
    
    let next = if end < all_tracks.len() {
        Some(format!("offset={}&limit={}", offset_val + limit_val, limit_val))
    } else {
        None
    };
    
    let previous = if offset_val > 0 {
        Some(format!("offset={}&limit={}", (offset_val - limit_val).max(0), limit_val))
    } else {
        None
    };
    
    models::SavedTracksResponse {
        href: "cached".to_string(),
        limit: limit_val,
        next,
        offset: offset_val,
        previous,
        total,
        items,
    }
}

// 原始的 API 调用函数
async fn fetch_saved_tracks_from_api(token: &str, limit: Option<i32>, offset: Option<i32>, market: Option<&str>) -> Result<models::SavedTracksResponse> {
    let client = Client::new();
    let mut request = client
        .get("https://api.spotify.com/v1/me/tracks")
        .header("Authorization", format!("Bearer {}", token));
    
    // 添加分页参数
    if let Some(limit_value) = limit {
        request = request.query(&[("limit", limit_value)]);
    }
    
    if let Some(offset_value) = offset {
        request = request.query(&[("offset", offset_value)]);
    }
    
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

    // 先获取响应文本
    let text = response.text().await?;

    // 解析JSON
    let saved_tracks = match serde_json::from_str::<models::SavedTracksResponse>(&text) {
        Ok(p) => p,
        Err(e) => {
            println!("JSON解析错误: {}", e);
            return Err(anyhow::anyhow!("解析响应失败: {}", e));
        }
    };
    
    Ok(saved_tracks)
}

// 修改后的 fetch_saved_tracks 函数，支持三层缓存
async fn fetch_saved_tracks(token: &str, limit: Option<i32>, offset: Option<i32>, market: Option<&str>) -> Result<models::SavedTracksResponse> {
    // 第一层：检查内存缓存
    let cache_loaded = {
        let loaded = CACHE_LOADED.lock().await;
        *loaded
    };
    
    if cache_loaded {
        println!("🚀 从内存缓存返回收藏歌曲");
        return Ok(get_all_tracks_from_cache().await);
    }
    
    // 第二层：检查sled数据库缓存
    if let Ok(Some(tracks_from_sled)) = get_saved_tracks_from_sled().await {
        // 将sled数据加载到内存缓存
        {
            let mut cache = SAVED_TRACKS_CACHE.lock().await;
            cache.clear();
            *cache = tracks_from_sled;
        }
        {
            let mut loaded = CACHE_LOADED.lock().await;
            *loaded = true;
        }
        
        println!("🚀 从sled数据库加载到内存并返回收藏歌曲");
        return Ok(get_all_tracks_from_cache().await);
    }
    
    // 第三层：从API获取并缓存到sled和内存
    println!("🌐 从API获取收藏歌曲并缓存");
    if let Err(e) = load_all_saved_tracks_to_cache(token).await {
        println!("加载缓存失败，回退到API调用: {}", e);
        return fetch_saved_tracks_from_api(token, limit, offset, market).await;
    }
    
    // 从缓存中一次性获取全部数据
    let response = get_all_tracks_from_cache().await;
    println!("🎯 返回全部 {} 首收藏歌曲", response.total);
    Ok(response)
}

// 添加歌曲到收藏 - 根据Spotify API文档实现
async fn add_track_to_saved(token: &str, track_id: &str) -> Result<()> {
    let client = Client::new();
    
    // 根据API文档，可以通过请求体传递IDs
    let request_body = serde_json::json!({
        "ids": [track_id]
    });
    
    let response = client
        .put("https://api.spotify.com/v1/me/tracks")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&request_body)  // 使用json方法自动设置Content-Length
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("添加收藏失败: {} - {}", status, error_text));
    }

    Ok(())
}

// 从收藏中移除歌曲 - 根据Spotify API文档实现
async fn remove_track_from_saved(token: &str, track_id: &str) -> Result<()> {
    let client = Client::new();
    
    // 根据API文档，可以通过请求体传递IDs
    let request_body = serde_json::json!({
        "ids": [track_id]
    });
    
    let response = client
        .delete("https://api.spotify.com/v1/me/tracks")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&request_body)  // 使用json方法自动设置Content-Length
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("取消收藏失败: {} - {}", status, error_text));
    }

    Ok(())
}

// 添加歌曲到收藏的命令
#[tauri::command]
pub async fn add_track_to_liked(track_id: String) -> tauri::Result<models::LikeTrackResponse> {
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(models::LikeTrackResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
            });
        }
    };

    match add_track_to_saved(&token, &track_id).await {
        Ok(_) => {
            // 更新缓存 - 获取歌曲详情并添加到缓存
            if let Ok(track_details) = crate::tracks::details::fetch_track_details(&token, &track_id, None).await {
                let mut track = track_details;
                track.liked = true;
                
                // 更新内存缓存
                {
                    let mut cache = SAVED_TRACKS_CACHE.lock().await;
                    cache.insert(track_id.clone(), track.clone());
                }
                
                // 更新sled数据库缓存 - 确保无论如何都要更新
                let mut tracks_for_sled = match get_saved_tracks_from_sled().await {
                    Ok(Some(tracks)) => tracks,
                    _ => {
                        // 如果sled中没有数据或获取失败，从内存缓存创建
                        let cache = SAVED_TRACKS_CACHE.lock().await;
                        cache.clone()
                    }
                };
                tracks_for_sled.insert(track_id.clone(), track);
                
                if let Err(e) = save_tracks_to_sled(&tracks_for_sled).await {
                    println!("⚠️ 更新sled数据库失败: {}", e);
                } else {
                    println!("💾 已将歌曲 {} 添加到sled数据库", track_id);
                }
                
                println!("✅ 已将歌曲 {} 添加到收藏缓存", track_id);
            }

            Ok(models::LikeTrackResponse {
                success: true,
                message: "成功添加到收藏".to_string(),
            })
        },
        Err(e) => Ok(models::LikeTrackResponse {
            success: false,
            message: format!("添加收藏失败: {}", e),
        }),
    }
}

// 从收藏中移除歌曲的命令
#[tauri::command]
pub async fn remove_track_from_liked(track_id: String) -> tauri::Result<models::LikeTrackResponse> {
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(models::LikeTrackResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
            });
        }
    };

    match remove_track_from_saved(&token, &track_id).await {
        Ok(_) => {
            // 从内存缓存中移除
            let removed_from_memory = {
                let mut cache = SAVED_TRACKS_CACHE.lock().await;
                cache.remove(&track_id).is_some()
            };
            
            if removed_from_memory {
                println!("✅ 已从内存缓存中移除歌曲 {}", track_id);
            }
            
            // 从sled数据库缓存中移除 - 确保无论如何都要更新
            let mut tracks_for_sled = match get_saved_tracks_from_sled().await {
                Ok(Some(tracks)) => tracks,
                _ => {
                    // 如果sled中没有数据或获取失败，从内存缓存创建
                    let cache = SAVED_TRACKS_CACHE.lock().await;
                    cache.clone()
                }
            };
            
            let removed_from_sled = tracks_for_sled.remove(&track_id).is_some();
            
            if let Err(e) = save_tracks_to_sled(&tracks_for_sled).await {
                println!("⚠️ 更新sled数据库失败: {}", e);
            } else if removed_from_sled {
                println!("💾 已从sled数据库中移除歌曲 {}", track_id);
            }

            Ok(models::LikeTrackResponse {
                success: true,
                message: "成功取消收藏".to_string(),
            })
        },
        Err(e) => Ok(models::LikeTrackResponse {
            success: false,
            message: format!("取消收藏失败: {}", e),
        }),
    }
}

// 添加清除缓存的函数（可选，用于强制刷新）
#[tauri::command]
pub async fn clear_saved_tracks_cache() -> tauri::Result<String> {
    // 清除内存缓存
    {
        let mut cache = SAVED_TRACKS_CACHE.lock().await;
        cache.clear();
    }
    {
        let mut loaded = CACHE_LOADED.lock().await;
        *loaded = false;
    }
    
    // 清除sled数据库缓存
    if let Ok(db) = get_likes_db() {
        if let Err(e) = db.remove("saved_tracks") {
            println!("⚠️ 清除sled数据库缓存失败: {}", e);
        } else {
            let _ = db.flush();
            println!("💾 已清除sled数据库缓存");
        }
    }
    
    Ok("缓存已清除".to_string())
}

// 强制刷新收藏歌曲缓存（从API重新获取）
#[tauri::command]
pub async fn refresh_saved_tracks_cache() -> tauri::Result<models::GetSavedTracksResponse> {
    println!("🔄 开始强制刷新收藏歌曲缓存...");
    
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(models::GetSavedTracksResponse {
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
    
    // 先清除所有缓存
    {
        let mut cache = SAVED_TRACKS_CACHE.lock().await;
        cache.clear();
    }
    {
        let mut loaded = CACHE_LOADED.lock().await;
        *loaded = false;
    }
    
    // 清除sled数据库缓存
    if let Ok(db) = get_likes_db() {
        let _ = db.remove("saved_tracks");
        let _ = db.flush();
    }
    
    // 强制从API重新加载
    match load_all_saved_tracks_to_cache(&token).await {
        Ok(_) => {
            let response = get_all_tracks_from_cache().await;
            println!("✅ 收藏歌曲缓存刷新完成，共 {} 首歌曲", response.total);
            
            Ok(models::GetSavedTracksResponse {
                success: true,
                message: format!("成功刷新收藏歌曲缓存，共 {} 首歌曲", response.total),
                tracks: Some(response.items),
                total: Some(response.total),
                limit: Some(response.limit),
                offset: Some(response.offset),
                next: response.next,
                previous: response.previous,
            })
        },
        Err(e) => Ok(models::GetSavedTracksResponse {
            success: false,
            message: format!("刷新收藏歌曲缓存失败: {}", e),
            tracks: None,
            total: None,
            limit: None,
            offset: None,
            next: None,
            previous: None,
        }),
    }
}

#[tauri::command]
pub async fn get_saved_tracks(limit: Option<i32>, offset: Option<i32>, market: Option<String>) -> tauri::Result<models::GetSavedTracksResponse> {
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(models::GetSavedTracksResponse {
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

    // 获取用户已保存的歌曲
    match fetch_saved_tracks(&token, limit, offset, market.as_deref()).await {
        Ok(response) => Ok(models::GetSavedTracksResponse {
            success: true,
            message: "成功获取已保存的歌曲".to_string(),
            tracks: Some(response.items),
            total: Some(response.total),
            limit: Some(response.limit),
            offset: Some(response.offset),
            next: response.next,
            previous: response.previous,
        }),
        Err(e) => Ok(models::GetSavedTracksResponse {
            success: false,
            message: format!("获取已保存的歌曲失败: {}", e),
            tracks: None,
            total: None,
            limit: None,
            offset: None,
            next: None,
            previous: None,
        }),
    }
} 