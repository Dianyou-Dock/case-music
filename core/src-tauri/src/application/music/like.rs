use crate::application::resp::ApplicationResp;
use crate::application::Source;
use crate::client::types::song_info::ClientSongInfo;
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::Debug;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LikeListReq {
    pub source: Source,
    pub user_id: u64,
    pub offset: u64,
    pub limit: u64,
}

#[derive(Serialize, Debug, Clone)]
pub struct LikeListResp<T: Serialize + Clone + Debug> {
    pub song_info_map: BTreeMap<u64, T>,
}

#[tauri::command]
pub async fn like_list(
    req: LikeListReq,
) -> Result<ApplicationResp<LikeListResp<ClientSongInfo>>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let song_id_list = if instance.like_list.is_empty() {
        instance
            .client
            .like_list(req.user_id)
            .await
            .map_err(InvokeError::from_anyhow)?
    } else {
        instance.like_list.clone()
    };

    let song_id_list = song_id_list
        .iter()
        .skip(req.offset as usize)
        .take(req.limit as usize)
        .cloned()
        .collect::<Vec<u64>>();

    let song_infos = instance
        .client
        .song_infos(&song_id_list)
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut song_info_map = BTreeMap::<u64, ClientSongInfo>::new();
    for (key, val) in song_id_list.into_iter().zip(song_infos.into_iter()) {
        song_info_map.insert(key, val);
    }

    Ok(ApplicationResp::success_data(LikeListResp {
        song_info_map,
    }))
}
