use crate::application::Application;

use crate::modules::impls::netesae::NetesaeModule;
use once_cell::sync::Lazy;
use tokio::sync::RwLock;

pub mod music_client;

pub mod ai_client;
pub mod application;
pub mod modules;
pub mod types;

pub static INSTANCE: Lazy<RwLock<Application>> = Lazy::new(|| {
    let netesae_module = NetesaeModule::new().unwrap();

    let app = Application::new(netesae_module);
    RwLock::new(app)
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // system api
            application::system::login::get_qr,
            application::system::login::login_by_qr,
            // music api
            application::music::like::like_list,
            // ai api
            application::ai::recommend::recommend_song,
            application::ai::recommend::recommend_style,
            application::ai::recommend::recommend_singer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
