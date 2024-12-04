use std::fmt::Debug;
use serde::{Deserialize, Serialize};
use tauri::ipc::InvokeError;
use crate::application::resp::ApplicationResp;
use crate::INSTANCE;
use crate::types::constants::MusicSource;
use crate::types::play_list_info::{PlayListInfoData, SongListInfo};
use crate::types::song_info::{SongInfo, SongInfoData};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ListSongsReq {
    pub source: MusicSource,
    pub list_id: u64,
    pub offset: usize,
    pub limit: usize,
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CollectListReq {
    pub source: MusicSource,
    pub user_id: u64,
}

#[tauri::command]
pub async fn collect_list(
    req: CollectListReq
) -> Result<ApplicationResp<Vec<SongListInfo>>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let list = match req.source {
        MusicSource::Netesae => {
            let result = instance.netesae.client().collect_list(req.user_id)
                .await.map_err(InvokeError::from_anyhow)?;
            result
        }
        MusicSource::Spotify => {todo!()}
        MusicSource::QQ => {todo!()}
        MusicSource::Apple => {todo!()}
    };


    Ok(ApplicationResp::success_data(list))
}

#[tauri::command]
pub async fn list_songs(req: ListSongsReq) -> Result<ApplicationResp<Vec<SongInfo>>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let list = match req.source {
        MusicSource::Netesae => {
            let result = instance.netesae.client().list_detail(req.list_id).await.map_err(InvokeError::from_anyhow)?;

            let songs = match result.data{ PlayListInfoData::Netesae(v) => {v.songs} };
            
            let skip = req.offset * req.limit;
            let take = req.limit;
            let list = songs.iter().skip(skip).take(take).map(|v|SongInfo{ data: SongInfoData::Netesae(v.clone()) }).collect::<Vec<_>>();
            list
        }
        MusicSource::Spotify => {todo!()}
        MusicSource::QQ => {todo!()}
        MusicSource::Apple => {todo!()}
    };

    Ok(ApplicationResp::success_data(list))
}