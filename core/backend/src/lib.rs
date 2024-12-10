use crate::application::Application;

use crate::modules::impls::netesae::NetesaeModule;
use once_cell::sync::Lazy;
use tokio::sync::RwLock;
use anyhow::Result;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {

    init_module().await.unwrap();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // system api
            application::system::login::get_qr,
            application::system::login::login_by_qr,
            application::system::login::logged,
            application::system::logout::logout,
            application::system::constants::music_source_list,
            application::system::constants::ai_source_list,
            // music api
            application::music::like::like_list,
            application::music::song::songs_url,
            application::music::list::collect_list,
            application::music::list::list_songs,
            // ai api
            application::ai::recommend::recommend_song,
            application::ai::recommend::recommend_style,
            application::ai::recommend::recommend_singer,
            application::ai::recommend::history_recommends,
            application::ai::recommend::current_recommends,
            application::ai::recommend::rand_recommends,
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