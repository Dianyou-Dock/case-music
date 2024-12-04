use crate::application::resp::ApplicationResp;
use crate::types::ai_recommend_info::{AiBenchmarkInfo, AiRecommendSongInfo};
use crate::types::constants::{
    MusicSource, RAND_RECOMMENDS_BENCHMARK_COUNT, RAND_RECOMMENDS_COUNT,
};
use crate::types::error::ApplicationError::AiNotUse;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::LikeListNotExist;
use crate::types::play_list_info::PlayListInfoData;
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::types::song_url::{SongRate, SongUrl};
use crate::{utils, INSTANCE};
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

#[tauri::command]
pub async fn rand_recommends(
    source: MusicSource,
) -> Result<ApplicationResp<Vec<SongUrl>>, InvokeError> {
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;

    let list = match source {
        MusicSource::Netesae => {
            if instance.netesae.like_list().is_none() {
                return Err(InvokeError::from_anyhow(LikeListNotExist.anyhow_err()));
            }

            let like_list_info = instance.netesae.like_list().unwrap();
            let like_list = match &like_list_info.data {
                PlayListInfoData::Netesae(v) => v.songs.clone(),
            };

            let len = like_list.len();
            let bench_mark_idxs = utils::random_num(len, RAND_RECOMMENDS_BENCHMARK_COUNT);

            let mut bench_mark_list = vec![];
            for idx in bench_mark_idxs {
                if let Some(song) = like_list.get(idx) {
                    bench_mark_list.push(song.clone());
                }
            }

            let mut recommends = vec![];
            for song in bench_mark_list {
                let recommend_req = AiRecommendSongInfo {
                    name: song.name,
                    singer: song.singer,
                };

                recommends.push(recommend_req);
            }

            let ai = instance.ai.as_ref().unwrap();
            let recommend_result = ai
                .rand_recommends(&recommends, RAND_RECOMMENDS_COUNT as u64)
                .await
                .map_err(InvokeError::from_anyhow)?;

            let mut songs = vec![];
            for recommend_info in recommend_result.recommends {
                let song_info = instance
                    .netesae
                    .client()
                    .search_song(&recommend_info.name, &recommend_info.singer)
                    .await
                    .map_err(InvokeError::from_anyhow)?;

                if let Some(v) = song_info {
                    let song_id = match v.data {
                        SongInfoData::Netesae(d) => d.id,
                    };
                    songs.push(song_id);
                }
            }

            let songs_url = instance
                .netesae
                .client()
                .songs_url(&songs, SongRate::M)
                .await
                .map_err(InvokeError::from_anyhow)?;
            songs_url
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
