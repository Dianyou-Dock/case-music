use crate::application::Application;

use crate::modules::impls::netesae::NetesaeModule;
use anyhow::Result;
use once_cell::sync::Lazy;
#[cfg(any(target_os = "android", all(target_os = "linux", feature = "native-webview", not(feature = "cef-webview"))))]
use tauri::Manager;
use tokio::sync::RwLock;

pub mod music_client;

pub mod ai_client;
pub mod application;
pub mod modules;
pub mod types;
pub mod utils;

pub static INSTANCE: Lazy<RwLock<Application>> = Lazy::new(|| {
    let netesae_module = NetesaeModule::new().unwrap();

    let app = Application::new(netesae_module);
    RwLock::new(app)
});

#[cfg(all(target_os = "linux", feature = "cef-webview"))]
type DesktopRuntime = tauri_runtime_cef::CefRuntime<tauri::EventLoopMessage>;
#[cfg(not(all(target_os = "linux", feature = "cef-webview")))]
type DesktopRuntime = tauri::Wry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    #[cfg(not(target_os = "android"))]
    init_module().await.unwrap();

    tauri::Builder::<DesktopRuntime>::default()
        .setup(|_app| {
            #[cfg(all(target_os = "linux", feature = "native-webview", not(feature = "cef-webview")))]
            if let Some(webview) = _app.get_webview_window("main") {
                use webkit2gtk::{SettingsExt, WebViewExt};
                webview.with_webview(|platform| {
                    if let Some(settings) = platform.inner().settings() {
                        settings.set_enable_encrypted_media(true);
                    }
                })?;
            }
            #[cfg(target_os = "android")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                crate::types::constants::set_data_path(_app.path().app_data_dir()?)?;
                _app.deep_link().on_open_url(|event| {
                    for url in event.urls() {
                        let raw_url = url.to_string();
                        tauri::async_runtime::spawn(async move {
                            application::system::spotify::handle_deep_link(raw_url).await;
                        });
                    }
                });
                match _app.deep_link().get_current() {
                    Ok(Some(urls)) => {
                        for url in urls {
                            tauri::async_runtime::spawn(async move {
                                application::system::spotify::handle_deep_link(url.to_string()).await;
                            });
                        }
                    }
                    Ok(None) => {}
                    Err(error) => log::warn!("Failed to read startup deep link: {error:#}"),
                }
                tauri::async_runtime::spawn(async {
                    if let Err(err) = init_module().await {
                        log::error!("Failed to initialize application: {err:#}");
                    }
                });
            }
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            // system api
            application::system::login::get_qr,
            application::system::login::login_by_qr,
            application::system::login::music_logged,
            application::system::qqmusic::qq_status,
            application::system::qqmusic::qq_login_start,
            application::system::qqmusic::qq_login_poll,
            application::system::qqmusic::qq_disconnect,
            application::system::qqmusic::qq_search,
            application::system::qqmusic::qq_playback_url,
            application::system::qqmusic::qq_search_playlists,
            application::system::qqmusic::qq_playlist,
            application::system::qqmusic::qq_user_playlists,
            application::system::qqmusic::qq_user_playlist,
            application::system::spotify::spotify_auth_start,
            application::system::spotify::spotify_auth_open,
            application::system::spotify::spotify_status,
            application::system::spotify::spotify_access_token,
            application::system::spotify::spotify_disconnect,
            application::system::spotify::spotify_playlists,
            application::system::spotify::spotify_playlist_items,
            application::system::spotify::spotify_saved_tracks,
            application::system::spotify::spotify_library_contains,
            application::system::spotify::spotify_set_liked,
            application::system::spotify::spotify_random_recommendations,
            application::system::spotify::spotify_play_track,
            application::system::spotify::spotify_play_playlist,
            application::system::spotify::spotify_player_action,
            application::system::spotify::spotify_start_playback,
            application::system::spotify::headless::spotify_headless_start,
            application::system::spotify::headless::spotify_headless_status,
            application::system::spotify::headless::spotify_headless_command,
            application::system::login::ai_logged,
            application::system::login::set_api_key,
            application::system::login::select_ai_source,
            application::system::logout::logout,
            application::system::constants::music_source_list,
            application::system::constants::ai_source_list,
            // music api
            application::music::like::like_list,
            application::music::like::like_song,
            application::music::song::songs_url,
            application::music::song::song_lyrics,
            application::music::song::song_release_date,
            application::music::list::collect_list,
            application::music::list::list_songs,
            application::music::list::refresh_playlist,
            // ai api
            application::ai::recommend::recommend_song,
            application::ai::recommend::recommend_style,
            application::ai::recommend::recommend_singer,
            application::ai::recommend::history_recommends,
            application::ai::recommend::current_recommends,
            application::ai::recommend::rand_recommends,
            application::ai::recommend::refresh_rand_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn init_module() -> Result<()> {
    let mut instance = INSTANCE.write().await;

    {
        if instance.netesae.client().logged().await {
            let info = instance.netesae.client().login_info().await?;
            instance.netesae.set_login_info(info);
        }
    }

    Ok(())
}
