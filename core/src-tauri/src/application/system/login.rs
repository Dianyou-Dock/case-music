use crate::application::resp::ApplicationResp;
use crate::client::resp::GetLoginQrResp;
use crate::INSTANCE;
use anyhow::Result;
use ncm_api::LoginInfo;
use serde::{Deserialize, Serialize};
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginReq {
    pub source: String,
    pub unikey: String,
}

#[tauri::command]
pub async fn get_qr() -> Result<ApplicationResp<GetLoginQrResp>, InvokeError> {
    let result = INSTANCE
        .get()
        .unwrap()
        .write()
        .await
        .client
        .get_login_qr()
        .await
        .map_err(InvokeError::from_anyhow)?;

    Ok(ApplicationResp::success_data(result))
}

#[tauri::command]
pub async fn login_by_qr(req: LoginReq) -> Result<ApplicationResp<LoginInfo>, InvokeError> {
    let result = INSTANCE
        .get()
        .unwrap()
        .write()
        .await
        .client
        .login_by_unikey(req.unikey)
        .await
        .map_err(InvokeError::from_anyhow)?;

    Ok(ApplicationResp::success_data(result))
}
