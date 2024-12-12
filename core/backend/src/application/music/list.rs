use crate::application::resp::ApplicationResp;
use crate::types::constants::MusicSource;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::NotLogin;
use crate::types::login_info::LoginInfoData;
use crate::types::play_list_info::{PlayListInfoData, SongListInfo};
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use tauri::ipc::InvokeError;

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
}

#[derive(Serialize, Debug, Clone)]
pub struct ListSongsResp {
    pub list: Vec<SongInfo>,
    pub likeds: Vec<bool>,
    pub total: u64,
}

#[tauri::command]
pub async fn collect_list(
    source: MusicSource,
) -> Result<ApplicationResp<Vec<SongListInfo>>, InvokeError> {
    let Some(login_info) = INSTANCE.read().await.netesae.login_info() else {
        return Err(InvokeError::from_anyhow(NotLogin.anyhow_err()));
    };

    let mut instance = INSTANCE.write().await;

    let list = match source {
        MusicSource::Netesae => {
            let info = match login_info.data {
                LoginInfoData::Netesae(v) => v,
            };

            let result = instance
                .netesae
                .client()
                .collect_list(info.uid)
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

    Ok(ApplicationResp::success_data(list))
}

#[tauri::command]
pub async fn list_songs(req: ListSongsReq) -> Result<ApplicationResp<ListSongsResp>, InvokeError> {
    let mut instance = INSTANCE.write().await;

    let Some(likeds) = INSTANCE.read().await.netesae.likeds() else {
        return Err(InvokeError::from_anyhow(NotLogin.anyhow_err()));
    };

    let skip = req.offset * req.limit;
    let take = req.limit;

    let (list, total, ls) = match req.source {
        MusicSource::Netesae => {
            if let Some(like_list_info) = instance.netesae.like_list() {
                let data = match &like_list_info.data {
                    PlayListInfoData::Netesae(v) => v,
                };
                if data.id == req.list_id {
                    let total = data.songs.len();
                    let ls = (0..take).map(|_| true).collect::<Vec<bool>>();
                    let page_list = data
                        .songs
                        .iter()
                        .skip(skip)
                        .take(take)
                        .map(|v| SongInfo {
                            data: SongInfoData::Netesae(v.clone()),
                        })
                        .collect::<Vec<_>>();
                    return Ok(ApplicationResp::success_data(ListSongsResp {
                        list: page_list,
                        likeds: ls,
                        total: total as u64,
                    }));
                }
            }

            let result = instance
                .netesae
                .client()
                .list_detail(req.list_id)
                .await
                .map_err(InvokeError::from_anyhow)?;

            let songs = match result.data {
                PlayListInfoData::Netesae(v) => v.songs,
            };

            let total = songs.len() as u64;

            let list = songs
                .iter()
                .skip(skip)
                .take(take)
                .map(|v| SongInfo {
                    data: SongInfoData::Netesae(v.clone()),
                })
                .collect::<Vec<_>>();

            let mut ls = vec![];
            for x in &songs {
                if likeds.contains(&x.id) {
                    ls.push(true);
                } else {
                    ls.push(false);
                }
            }

            (list, total, ls)
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

    Ok(ApplicationResp::success_data(ListSongsResp {
        list,
        likeds: ls,
        total,
    }))
}
