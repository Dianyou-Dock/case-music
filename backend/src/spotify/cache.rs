use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::sync::OnceLock;
use crate::spotify::playlists::PlaylistTrackObject;
use crate::setting::{SPOTIFY_CACHE_FILE_PATH, CONFIG_DIR_PATH};

static DB: OnceLock<sled::Db> = OnceLock::new();

/// 初始化数据库，在应用启动时调用
pub fn init_cache_db() -> Result<()> {
    let config_dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("无法获取用户主目录"))?
        .join(CONFIG_DIR_PATH);

    // 确保配置目录存在
    std::fs::create_dir_all(&config_dir)?;
    
    println!("📁 配置目录: {:?}", config_dir);
    
    // 数据库文件直接放在配置目录下
    let db_path = config_dir.join("playlist_cache.db");
    if !db_path.exists() {
        println!("🆕 创建新的缓存数据库: {:?}", db_path);
    } else {
        println!("📂 加载现有缓存数据库: {:?}", db_path);
    }
    
    // 初始化数据库连接
    let db = sled::open(&db_path)
        .map_err(|e| anyhow::anyhow!("初始化缓存数据库失败: {}", e))?;
    
    // 设置到全局变量
    DB.set(db).map_err(|_| anyhow::anyhow!("数据库已经被初始化"))?;
    
    println!("✅ 缓存数据库初始化完成");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CachedPlaylistItems {
    pub items: Vec<PlaylistTrackObject>,
    pub total: i32,
    pub cached_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

impl CachedPlaylistItems {
    pub fn new(items: Vec<PlaylistTrackObject>, total: i32) -> Self {
        let now = chrono::Utc::now();
        Self {
            items,
            total,
            cached_at: now,
            expires_at: now + chrono::Duration::hours(1), // 缓存1小时
        }
    }

    pub fn is_expired(&self) -> bool {
        chrono::Utc::now() > self.expires_at
    }
}

fn get_db() -> Result<&'static sled::Db> {
    DB.get().ok_or_else(|| anyhow::anyhow!("缓存数据库未初始化，请确保在程序启动时调用了 init_cache_db()"))
}

pub fn get_playlist_items_cache(playlist_id: &str) -> Result<Option<CachedPlaylistItems>> {
    let db = get_db()?;
    
    match db.get(playlist_id)? {
        Some(data) => {
            let cached: CachedPlaylistItems = bincode::deserialize(&data)?;
            // 直接返回缓存数据，不检查是否过期
            Ok(Some(cached))
        },
        None => Ok(None)
    }
}

pub fn set_playlist_items_cache(playlist_id: &str, items: Vec<PlaylistTrackObject>, total: i32) -> Result<()> {
    let db = get_db()?;
    let cached = CachedPlaylistItems::new(items, total);
    let serialized = bincode::serialize(&cached)?;
    
    db.insert(playlist_id, serialized)?;
    db.flush()?;
    
    println!("✅ 已缓存播放列表 {} 的 {} 首歌曲", playlist_id, total);
    Ok(())
}

pub fn clear_playlist_cache(playlist_id: &str) -> Result<()> {
    let db = get_db()?;
    db.remove(playlist_id)?;
    db.flush()?;
    Ok(())
}

pub fn clear_all_cache() -> Result<()> {
    let db = get_db()?;
    db.clear()?;
    db.flush()?;
    Ok(())
}

/// 获取缓存状态信息，用于调试
pub fn get_cache_status() -> Result<String> {
    let db = get_db()?;
    let count = db.len();
    let mut info = format!("缓存数据库状态:\n- 缓存项数量: {}\n", count);
    
    // 遍历所有键，显示缓存的播放列表信息
    for item in db.iter() {
        match item {
            Ok((key, value)) => {
                let playlist_id = String::from_utf8_lossy(&key);
                match bincode::deserialize::<CachedPlaylistItems>(&value) {
                    Ok(cached) => {
                        info.push_str(&format!(
                            "- 播放列表 {}: {} 首歌曲, 缓存时间: {}\n",
                            playlist_id,
                            cached.total,
                            cached.cached_at.format("%Y-%m-%d %H:%M:%S")
                        ));
                    },
                    Err(_) => {
                        info.push_str(&format!("- 播放列表 {}: 数据解析失败\n", playlist_id));
                    }
                }
            },
            Err(e) => {
                info.push_str(&format!("- 读取缓存项失败: {}\n", e));
            }
        }
    }
    
    Ok(info)
}

#[tauri::command]
pub async fn get_cache_info() -> tauri::Result<String> {
    match get_cache_status() {
        Ok(info) => Ok(info),
        Err(e) => Ok(format!("获取缓存状态失败: {}", e))
    }
} 