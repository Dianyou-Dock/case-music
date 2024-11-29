use crate::application::resp::ApplicationResp;
use crate::types::ai_recommend_info::{AiBenchmarkInfo, AiRecommendSongInfo};
use crate::types::constants::MusicSource;
use crate::types::error::ApplicationError::AiNotUse;
use crate::types::error::ErrorHandle;
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::Debug;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecommendReq {
    pub source: MusicSource,
    pub song: String,
    pub singer: String,
    pub recommend_song_count: u64,
    pub recommend_singer_count: u64,
    pub previous: Option<Vec<AiRecommendSongInfo>>,
}

#[derive(Serialize, Debug, Clone)]
pub struct RecommendSongResp<T: Serialize + Clone + Debug> {
    pub song_infos: Vec<T>,
    pub benchmark_info: AiBenchmarkInfo,
}

#[tauri::command]
pub async fn recommend_song(
    req: RecommendReq,
) -> Result<ApplicationResp<RecommendSongResp<SongInfo>>, InvokeError> {
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let ai = instance.ai.as_ref().unwrap();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
    };

    let recommend_result = ai
        .recommend_song(recommend_param, req.recommend_song_count, req.previous)
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];
    let mut map = BTreeMap::new();

    match req.source {
        MusicSource::Netesae => {
            for x in recommend_result.recommends {
                if let Some(info) = instance
                    .netesae
                    .client()
                    .search_song(&x.name, &x.singer)
                    .await
                    .map_err(InvokeError::from_anyhow)?
                {
                    let song_id = match &info.data {
                        SongInfoData::Netesae(d) => d.id,
                    };
                    map.insert(song_id, info.clone());
                    list.push(info);
                }
            }
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

    if !map.is_empty() {
        instance.history_recommends.append(&mut map);

        instance.current_recommends.clear();
        instance.current_recommends.append(&mut map);
    };

    Ok(ApplicationResp::success_data(RecommendSongResp {
        song_infos: list,
        benchmark_info: recommend_result.benchmark,
    }))
}

#[tauri::command]
pub async fn recommend_style(
    req: RecommendReq,
) -> Result<ApplicationResp<RecommendSongResp<SongInfo>>, InvokeError> {
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let ai = instance.ai.as_ref().unwrap();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
    };

    let recommend_result = ai
        .recommend_style(recommend_param, req.recommend_song_count, req.previous)
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];
    let mut map = BTreeMap::new();

    match req.source {
        MusicSource::Netesae => {
            for x in recommend_result.recommends {
                if let Some(info) = instance
                    .netesae
                    .client()
                    .search_song(&x.name, &x.singer)
                    .await
                    .map_err(InvokeError::from_anyhow)?
                {
                    let song_id = match &info.data {
                        SongInfoData::Netesae(d) => d.id,
                    };
                    map.insert(song_id, info.clone());
                    list.push(info);
                }
            }
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

    if !map.is_empty() {
        instance.history_recommends.append(&mut map);

        instance.current_recommends.clear();
        instance.current_recommends.append(&mut map);
    };

    Ok(ApplicationResp::success_data(RecommendSongResp {
        song_infos: list,
        benchmark_info: recommend_result.benchmark,
    }))
}

#[tauri::command]
pub async fn recommend_singer(
    req: RecommendReq,
) -> Result<ApplicationResp<RecommendSongResp<SongInfo>>, InvokeError> {
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let ai = instance.ai.as_ref().unwrap();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
    };

    let previous = if let Some(pre) = req.previous {
        let singers = pre.iter().map(|v| v.singer.clone()).collect();
        Some(singers)
    } else {
        None
    };

    let recommend_result = ai
        .recommend_singer(
            recommend_param,
            req.recommend_singer_count,
            req.recommend_song_count,
            previous,
        )
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];
    let mut map = BTreeMap::new();

    match req.source {
        MusicSource::Netesae => {
            for (_singer, songs) in recommend_result.recommends {
                for x in songs {
                    if let Some(info) = instance
                        .netesae
                        .client()
                        .search_song(&x.name, &x.singer)
                        .await
                        .map_err(InvokeError::from_anyhow)?
                    {
                        let song_id = match &info.data {
                            SongInfoData::Netesae(d) => d.id,
                        };
                        map.insert(song_id, info.clone());
                        list.push(info);
                    }
                }
            }
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

    if !map.is_empty() {
        instance.history_recommends.append(&mut map);

        instance.current_recommends.clear();
        instance.current_recommends.append(&mut map);
    };

    Ok(ApplicationResp::success_data(RecommendSongResp {
        song_infos: list,
        benchmark_info: recommend_result.benchmark,
    }))
}

#[tauri::command]
pub async fn history_recommends() -> Result<ApplicationResp<BTreeMap<u64, SongInfo>>, InvokeError> {
    let instance = INSTANCE.read().await;

    let map = instance.history_recommends.clone();

    Ok(ApplicationResp::success_data(map))
}

#[tauri::command]
pub async fn current_recommends() -> Result<ApplicationResp<BTreeMap<u64, SongInfo>>, InvokeError> {
    let instance = INSTANCE.read().await;

    let map = instance.history_recommends.clone();

    Ok(ApplicationResp::success_data(map))
}
