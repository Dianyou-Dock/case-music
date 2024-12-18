use crate::ai_client::impls::kimi::Kimi;
use crate::application::resp::ApplicationResp;
use crate::types::constants::{AiSource, MusicSource};
use crate::types::error::MusicClientError;
use crate::types::login_info::{LoginInfo, LoginInfoData, LoginQrInfo};
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
pub struct AiLoggedData {
    pub used: bool,
    pub disabled: bool,
}

#[tauri::command]
pub async fn ai_logged() -> Result<ApplicationResp<BTreeMap<String, AiLoggedData>>, InvokeError> {
    let instance = INSTANCE.read().await;

    let mut map = BTreeMap::new();

    AiSource::display_list().iter().for_each(|ai| {
        map.insert(
            ai.id.clone(),
            AiLoggedData {
                used: false,
                disabled: false,
            },
        );
    });

    if let Some(ai) = &instance.ai {
        let ai_source = ai.ai_source();

        map.insert(
            ai_source.to_string(),
            AiLoggedData {
                used: true,
                disabled: false,
            },
        );
    };

    Ok(ApplicationResp::success_data(map))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MusicLoggedData {
    pub logged: bool,
    pub disable: bool,
}

#[tauri::command]
pub async fn music_logged(
) -> Result<ApplicationResp<BTreeMap<String, MusicLoggedData>>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let mut map = BTreeMap::new();

    // netease
    {
        let result = instance.netesae.client().logged().await;
        let empty = instance.netesae.like_list().is_none();

        if result && empty {
            let login_info = instance.netesae.login_info().unwrap(); // safe
            let user_info = match login_info.data {
                LoginInfoData::Netesae(v) => v,
            };
            let like_list = instance
                .netesae
                .client()
                .like_list(user_info.uid)
                .await
                .map_err(InvokeError::from_anyhow)?;
            instance
                .netesae
                .set_like_list(like_list)
                .map_err(InvokeError::from_anyhow)?;
        }

        map.insert(
            MusicSource::Netesae.to_string(),
            MusicLoggedData {
                logged: result,
                disable: false,
            },
        );
    }

    // qq
    {
        map.insert(
            MusicSource::QQ.to_string(),
            MusicLoggedData {
                logged: false,
                disable: true,
            },
        );
    }

    // apple
    {
        map.insert(
            MusicSource::Apple.to_string(),
            MusicLoggedData {
                logged: false,
                disable: true,
            },
        );
    }

    // spotify
    {
        map.insert(
            MusicSource::Spotify.to_string(),
            MusicLoggedData {
                logged: false,
                disable: true,
            },
        );
    }

    Ok(ApplicationResp::success_data(map))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiSetApiKeyReq {
    pub source: AiSource,
    pub api_key: String,
}

#[tauri::command]
pub async fn set_api_key(
    req: AiSetApiKeyReq,
) -> std::result::Result<ApplicationResp<()>, InvokeError> {
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
