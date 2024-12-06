use crate::application::resp::ApplicationResp;
use crate::types::constants::MusicSource;
use crate::INSTANCE;
use tauri::ipc::InvokeError;

#[tauri::command]
pub async fn logout(source: MusicSource) -> anyhow::Result<ApplicationResp<()>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    match source {
        MusicSource::Netesae => {
            instance
                .netesae
                .client()
                .logout()
                .await
                .map_err(InvokeError::from_anyhow)?;
        }
        MusicSource::Spotify => {}
        MusicSource::QQ => {}
        MusicSource::Apple => {}
    }

    Ok(ApplicationResp::success_data(()))
}
