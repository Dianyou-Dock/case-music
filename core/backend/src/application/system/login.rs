use crate::application::resp::ApplicationResp;
use crate::types::constants::MusicSource;
use crate::types::login_info::{LoginInfo, LoginInfoData, LoginQrInfo};
use crate::INSTANCE;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginReq {
    pub source: MusicSource,
    pub unikey: String,
}

#[tauri::command]
pub async fn get_qr(source: MusicSource) -> Result<ApplicationResp<LoginQrInfo>, InvokeError> {
    let result = match source {
        MusicSource::Netesae => {
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
        MusicSource::Spotify => {
            todo!()
        }
        MusicSource::QQ => {
            todo!()
        }
        MusicSource::Apple => {
            todo!()
        }
    };

    Ok(ApplicationResp::success_data(result))
}

#[tauri::command]
pub async fn login_by_qr(req: LoginReq) -> Result<ApplicationResp<LoginInfo>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let result = match req.source {
        MusicSource::Netesae => {
            let result = instance
                .netesae
                .client()
                .login_by_unikey(req.unikey)
                .await
                .map_err(InvokeError::from_anyhow)?;

            // login success, get user like list
            let user_id = match &result.data {
                LoginInfoData::Netesae(v) => v.uid,
            };
            let like_list = instance
                .netesae
                .client()
                .like_list(user_id)
                .await
                .map_err(InvokeError::from_anyhow)?;
            instance
                .netesae
                .set_like_list(like_list)
                .map_err(InvokeError::from_anyhow)?;

            result
        }
        MusicSource::Spotify => {
            todo!()
        }
        MusicSource::QQ => {
            todo!()
        }
        MusicSource::Apple => {
            todo!()
        }
    };

    Ok(ApplicationResp::success_data(result))
}

#[tauri::command]
pub async fn logged(source: MusicSource) -> Result<ApplicationResp<bool>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    match source {
        MusicSource::Netesae => {
            let result = instance.netesae.client().logged();

            // if already logged, get like list
            if result {
                let login_info = instance
                    .netesae
                    .client()
                    .login_info()
                    .await
                    .map_err(InvokeError::from_anyhow)?;
                let user_id = match login_info.data {
                    LoginInfoData::Netesae(v) => v.uid,
                };

                let like_list = instance
                    .netesae
                    .client()
                    .like_list(user_id)
                    .await
                    .map_err(InvokeError::from_anyhow)?;
                instance
                    .netesae
                    .set_like_list(like_list)
                    .map_err(InvokeError::from_anyhow)?;
            }

            Ok(ApplicationResp::success_data(result))
        }
        MusicSource::Spotify => {
            todo!()
        }
        MusicSource::QQ => {
            todo!()
        }
        MusicSource::Apple => {
            todo!()
        }
    }
}
