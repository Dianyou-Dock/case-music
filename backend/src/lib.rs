pub mod setting;
pub mod spotify;
pub mod tracks;
pub mod artists;
pub mod album;

use tokio::sync::Mutex;
use std::sync::Arc;
use actix_web::dev::ServerHandle;
use once_cell::sync::Lazy;
use tokio::sync::oneshot;

// 全局变量，用于存储 Spotify 服务器句柄
pub static SPOTIFY_SERVER_HANDLE: Lazy<Mutex<Option<ServerHandle>>> = 
    Lazy::new(|| Mutex::new(None));

// 全局变量，用于存储 Spotify 刷新任务的取消通道
pub static SPOTIFY_REFRESH_CANCEL: Lazy<Mutex<Option<oneshot::Sender<()>>>> =
    Lazy::new(|| Mutex::new(None));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化缓存数据库
    if let Err(e) = spotify::cache::init_cache_db() {
        println!("⚠️ 缓存数据库初始化失败: {}", e);
    }
    
    // 初始化收藏歌曲数据库
    if let Err(e) = tracks::likes::init_likes_db() {
        println!("⚠️ 收藏歌曲数据库初始化失败: {}", e);
    }
    
    // 检查 Spotify 配置
    let spotify_data = match setting::spotify::SpotifyData::load_from_file() {
        Ok(data) => Some(data),
        Err(_) => {
            println!("Spotify 配置文件不存在");
            None
        }
    };

    // 检查配置是否有效
    if spotify_data.is_some() && spotify_data.as_ref().unwrap().is_valid() {
        // 启动 Spotify 服务器
        let spotify_data = spotify_data.unwrap();
        tokio::spawn(async move {
            if let Ok(server_info) = spotify::server::start_server(spotify_data).await {
                println!("Spotify 服务器已启动: {}", server_info.redirect_uri);
                
                // 保存服务器句柄到全局变量
                {
                    let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
                    *handle_guard = Some(server_info.server_handle);
                }
                
                // 保存刷新任务取消通道到全局变量
                {
                    let mut cancel_guard = SPOTIFY_REFRESH_CANCEL.lock().await;
                    *cancel_guard = Some(server_info.refresh_task_cancel);
                }
            }
        });
    }

    // 启动应用
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            spotify::login::spotify_login,
            spotify::login::check_spotify_login,
            spotify::login::spotify_logout,
            spotify::login::force_spotify_relogin,
            spotify::playlists::get_spotify_playlists,
            spotify::playlists::get_spotify_playlist,
            spotify::playlists::get_user_spotify_playlists,
            spotify::playlists::get_spotify_playlist_items,
            spotify::user::get_current_user_profile,
            spotify::token::get_valid_token,
            spotify::token::get_token_info,
            tracks::likes::get_saved_tracks,
            tracks::likes::clear_saved_tracks_cache,
            tracks::likes::refresh_saved_tracks_cache,
            tracks::likes::add_track_to_liked,
            tracks::likes::remove_track_from_liked,
            tracks::details::get_track_details,
            spotify::cache::get_cache_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
