// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tokio::main]
async fn main() {
    #[cfg(all(target_os = "linux", feature = "cef-webview"))]
    {
        tauri_runtime_cef::configure(tauri_runtime_cef::CefConfig {
            identifier: "com.case-music.app".into(),
            command_line_args: vec![
                ("--no-sandbox".into(), None),
                ("--no-zygote".into(), None),
                ("--disable-gpu".into(), None),
                #[cfg(debug_assertions)]
                ("--remote-debugging-port".into(), Some("9223".into())),
            ],
            ..Default::default()
        });
        if std::env::args().any(|arg| arg.starts_with("--type=")) {
            tauri_runtime_cef::run_cef_helper_process();
            return;
        }
    }
    env_logger::init();
    core_lib::run().await
}
