use crate::application::resp::ApplicationResp;
use crate::application::Source;
use crate::types::login_info::{LoginInfo, LoginQrInfo};
use crate::INSTANCE;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginReq {
    pub source: Source,
    pub unikey: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct LoginResp<T: Serialize + Clone + Debug> {
    #[serde(flatten)]
    pub data: T,
}

#[tauri::command]
pub async fn get_qr(source: Source) -> Result<ApplicationResp<LoginQrInfo>, InvokeError> {
    let result = match source {
        Source::Netesae => {
            let result = INSTANCE
                .write()
                .await
                .netesae
                .client()
                .login_qr()
                .await
                .map_err(InvokeError::from_anyhow)?;
            result
        }
        Source::Spotify => {
            todo!()
        }
        Source::QQ => {
            todo!()
        }
        Source::Apple => {
            todo!()
        }
    };

    Ok(ApplicationResp::success_data(result))
}

#[tauri::command]
pub async fn login_by_qr(
    req: LoginReq,
) -> Result<ApplicationResp<LoginResp<LoginInfo>>, InvokeError> {
    let result = match req.source {
        Source::Netesae => {
            let result = INSTANCE
                .write()
                .await
                .netesae
                .client()
                .login_by_unikey(req.unikey)
                .await
                .map_err(InvokeError::from_anyhow)?;
            result
        }
        Source::Spotify => {
            todo!()
        }
        Source::QQ => {
            todo!()
        }
        Source::Apple => {
            todo!()
        }
    };

    Ok(ApplicationResp::success_data(LoginResp { data: result }))
}
