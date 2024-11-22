use crate::application::resp::ApplicationResp;
use crate::application::MusicSource;
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
}

#[tauri::command]
pub async fn songs_url(
    req: SongsUrlReq,
) -> Result<ApplicationResp<SongsUrlResp<SongUrl>>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let list = match req.source {
        MusicSource::Netesae => {
            let result = instance
                .netesae
                .client()
                .songs_url(&req.songs, req.rate)
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

    Ok(ApplicationResp::success_data(SongsUrlResp { urls: list }))
}
