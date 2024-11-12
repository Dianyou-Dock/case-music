use crate::application::Application;
use crate::client::impls::netesae_cloud::NeteaseClient;
use once_cell::sync::Lazy;
use tokio::sync::RwLock;

pub mod client;

pub mod application;

pub static INSTANCE: Lazy<RwLock<Application>> = Lazy::new(|| {
    let netesae_client = NeteaseClient::new().unwrap();
    let app = Application::new(Box::new(netesae_client));
    RwLock::new(app)
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            application::system::login::get_qr,
            application::system::login::login_by_qr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
