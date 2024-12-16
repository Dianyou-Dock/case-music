use crate::application::resp::ApplicationResp;
use crate::types::constants::MusicSource;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::NotLogin;
use crate::types::song_url::{SongRate, SongUrl};
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SongsUrlReq {
    pub source: MusicSource,
    pub songs: Vec<u64>,
    pub rate: SongRate,
}

#[derive(Serialize, Debug, Clone)]
pub struct SongsUrlResp<T: Serialize + Clone + Debug> {
    pub urls: Vec<T>,
    pub likeds: Vec<bool>,
}

#[tauri::command]
pub async fn songs_url(
    req: SongsUrlReq,
) -> Result<ApplicationResp<SongsUrlResp<SongUrl>>, InvokeError> {
    let Some(likeds) = INSTANCE.read().await.netesae.likeds() else {
        return Err(InvokeError::from_anyhow(NotLogin.anyhow_err()));
    };

    let mut instance = INSTANCE.write().await;

    let (list, ls) = match req.source {
        MusicSource::Netesae => {
            let result = instance
                .netesae
                .client()
                .songs_url(&req.songs, req.rate)
                .await
                .map_err(InvokeError::from_anyhow)?;

            let mut ls = vec![];
            for id in &req.songs {
                if likeds.contains(id) {
                    ls.push(true);
                } else {
                    ls.push(false);
                }
            }
            (result, ls)
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

    Ok(ApplicationResp::success_data(SongsUrlResp {
        urls: list,
        likeds: ls,
    }))
}
