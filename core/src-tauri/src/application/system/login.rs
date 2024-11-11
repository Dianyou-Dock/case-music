use crate::INSTANCE;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginResp {
    pub code: i32,
    pub msg: String,
    pub data: Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginReq {
    pub source: String,
}

#[tauri::command]
pub async fn get_qr(_req: LoginReq) -> Result<LoginResp, InvokeError> {
    let result = INSTANCE
        .get()
        .unwrap()
        .write()
        .await
        .client
        .get_login_qr()
        .await
        .map_err(InvokeError::from_anyhow)?;
    let data = serde_json::to_value(result).map_err(|e| InvokeError::from_error(e))?;

    Ok(LoginResp {
        code: 0,
        msg: "".to_string(),
        data,
    })
}
