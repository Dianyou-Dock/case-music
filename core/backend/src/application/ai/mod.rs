pub(crate) mod recommend;

use crate::ai_client::impls::kimi::Kimi;
use crate::application::resp::ApplicationResp;
use crate::types::constants::AiSource;
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiSetApiKeyReq {
    pub source: AiSource,
    pub api_key: String,
}

#[tauri::command]
pub async fn set_api_key(req: AiSetApiKeyReq) -> Result<ApplicationResp<()>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    match req.source {
        AiSource::Kimi => {
            let kimi = Kimi::new(req.api_key)
                .await
                .map_err(InvokeError::from_anyhow)?;

            instance.ai.replace(Box::new(kimi));
        }
    }

    Ok(ApplicationResp::success())
}
