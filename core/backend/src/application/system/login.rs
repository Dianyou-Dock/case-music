use crate::application::resp::ApplicationResp;
use crate::types::constants::MusicSource;
use crate::types::error::MusicClientError;
use crate::types::login_info::{LoginInfo, LoginQrInfo};
use crate::INSTANCE;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
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

    let (result, msg, code) = match req.source {
        MusicSource::Netesae => {
            let (code, result) = instance
                .netesae
                .client()
                .login_by_unikey(req.unikey)
                .await
                .map_err(InvokeError::from_anyhow)?;

            let msg = if code == 0 {
                "".to_string()
            } else {
                MusicClientError::from_code(code)
                    .map_err(InvokeError::from_anyhow)?
                    .to_string()
            };

            (result, msg, code)
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

    let resp = if let Some(data) = result {
        ApplicationResp::success_data(data)
    } else {
        ApplicationResp::msg_code(msg, code)
    };

    Ok(resp)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoggedData{
    pub logged: bool,
    pub disable: bool,
}

#[tauri::command]
pub async fn logged() -> Result<ApplicationResp<BTreeMap<String, LoggedData>>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let mut map = BTreeMap::new();

    // netease
    {
        let result = instance.netesae.client().logged().await;
        map.insert(MusicSource::Netesae.to_string(), LoggedData{ logged: result, disable: false });
    }

    // qq
    {
        map.insert(MusicSource::QQ.to_string(), LoggedData{ logged: false, disable: true });
    }

    // apple
    {
        map.insert(MusicSource::Apple.to_string(), LoggedData{ logged: false, disable: true });
    }

    // spotify
    {
        map.insert(MusicSource::Spotify.to_string(), LoggedData{ logged: false, disable: true });
    }

    Ok(ApplicationResp::success_data(map))
}
