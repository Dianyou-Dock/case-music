use crate::application::resp::{ApplicationResp, ListResp};
use crate::types::constants::MusicSource;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::NotLogin;
use crate::types::login_info::LoginInfoData;
use crate::types::play_list_info::{PlayListInfoData, SongListData, SongListInfo};
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

#[tauri::command]
pub async fn refresh_playlist(list_id: u64) -> Result<ApplicationResp<()>, InvokeError> {
    INSTANCE.write().await.playlist_cache.remove(&list_id);
    Ok(ApplicationResp::success())
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

            let liked_id = instance.netesae.like_list().map(|list| match &list.data {
                PlayListInfoData::Netesae(data) => data.id,
            });
            let mut result = instance
                .netesae
                .client()
                .collect_list(info.uid)
                .await
                .map_err(InvokeError::from_anyhow)?;
            if let Some(liked_id) = liked_id {
                result.retain(|list| match &list.data {
                    SongListData::Netesae(data) => data.id != liked_id,
                });
            }
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
pub async fn list_songs(req: ListSongsReq) -> Result<ApplicationResp<ListResp>, InvokeError> {
    let Some(likeds) = INSTANCE.read().await.netesae.likeds() else {
        return Err(InvokeError::from_anyhow(NotLogin.anyhow_err()));
    };
    let mut instance = INSTANCE.write().await;

    let skip = req.offset * req.limit;
    let take = req.limit;

    let (list, total, ls, name, cover_img_url) = match req.source {
        MusicSource::Netesae => {
            if let Some(like_list_info) = instance.netesae.like_list() {
                let data = match &like_list_info.data {
                    PlayListInfoData::Netesae(v) => v,
                };
                if data.id == req.list_id {
                    let total = data.songs.len();
                    let page_list = data
                        .songs
                        .iter()
                        .skip(skip)
                        .take(take)
                        .map(|v| SongInfo {
                            data: SongInfoData::Netesae(v.clone()),
                            song_type: None,
                            release_year: None,
                            release_date: None,
                        })
                        .collect::<Vec<_>>();
                    let ls = vec![true; page_list.len()];
                    return Ok(ApplicationResp::success_data(ListResp {
                        id: req.list_id,
                        name: data.name.clone(),
                        cover_img_url: data.cover_img_url.clone(),
                        songs: page_list,
                        likeds: ls,
                        total: total as u64,
                    }));
                }
            }

            let result = if let Some(cached) = instance.playlist_cache.get(&req.list_id) {
                cached.clone()
            } else {
                let detail = instance.netesae.client().list_detail(req.list_id).await.map_err(InvokeError::from_anyhow)?;
                instance.playlist_cache.insert(req.list_id, detail.clone());
                detail
            };

            let (songs, name, cover_img_url) = match result.data {
                PlayListInfoData::Netesae(v) => (v.songs, v.name, v.cover_img_url),
            };

            let total = songs.len() as u64;

            let list = songs
                .iter()
                .skip(skip)
                .take(take)
                .map(|v| SongInfo {
                    data: SongInfoData::Netesae(v.clone()),
                    song_type: None,
                    release_year: None,
                    release_date: None,
                })
                .collect::<Vec<_>>();

            let ls = songs.iter().skip(skip).take(take).map(|song| likeds.contains(&song.id)).collect();

            (list, total, ls, name, cover_img_url)
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

    Ok(ApplicationResp::success_data(ListResp {
        id: req.list_id,
        name,
        cover_img_url,
        likeds: ls,
        total,
        songs: list,
    }))
}
