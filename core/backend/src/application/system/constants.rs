use crate::application::resp::ApplicationResp;
use crate::types::constants::{AiSource, DisplayData, MusicSource};
use tauri::ipc::InvokeError;

#[tauri::command]
pub async fn music_source_list() -> Result<ApplicationResp<Vec<DisplayData>>, InvokeError> {
    Ok(ApplicationResp::success_data(MusicSource::display_list()))
}

#[tauri::command]
pub async fn ai_source_list() -> Result<ApplicationResp<Vec<DisplayData>>, InvokeError> {
    Ok(ApplicationResp::success_data(AiSource::display_list()))
}
