use crate::application::Application;
use crate::client::impls::netesae_cloud::NeteaseClient;
use tokio::sync::RwLock;

pub mod client;

pub mod application;

pub static INSTANCE: once_cell::sync::OnceCell<RwLock<Application>> =
    once_cell::sync::OnceCell::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    let netesae_client = NeteaseClient::new().unwrap();
    let app = Application::new(Box::new(netesae_client));
    INSTANCE.get_or_init(|| RwLock::new(app));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![application::system::login::get_qr,])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
