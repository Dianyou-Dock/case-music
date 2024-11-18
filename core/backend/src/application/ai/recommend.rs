use crate::application::resp::ApplicationResp;
use crate::application::MusicSource;
use crate::types::ai_recommend_info::AiRecommendSongInfo;
use crate::types::error::ApplicationError::AiNotUse;
use crate::types::error::ErrorHandle;
use crate::types::song_info::SongInfo;
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use tauri::ipc::InvokeError;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecommendReq {
    pub source: MusicSource,
    pub song: String,
    pub singer: String,
    pub recommend_song_count: u64,
    pub recommend_singer_count: u64,
}

#[derive(Serialize, Debug, Clone)]
pub struct RecommendSongResp<T: Serialize + Clone + Debug> {
    pub song_infos: Vec<T>,
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
        .recommend_song(recommend_param, req.recommend_song_count)
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];

    match req.source {
        MusicSource::Netesae => {
            for x in recommend_result {
                if let Some(info) = instance
                    .netesae
                    .client()
                    .search_song(&x.name, &x.singer)
                    .await
                    .map_err(InvokeError::from_anyhow)?
                {
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

    Ok(ApplicationResp::success_data(RecommendSongResp {
        song_infos: list,
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
        .recommend_style(recommend_param, req.recommend_song_count)
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];

    match req.source {
        MusicSource::Netesae => {
            for x in recommend_result {
                if let Some(info) = instance
                    .netesae
                    .client()
                    .search_song(&x.name, &x.singer)
                    .await
                    .map_err(InvokeError::from_anyhow)?
                {
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

    Ok(ApplicationResp::success_data(RecommendSongResp {
        song_infos: list,
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

    let recommend_result = ai
        .recommend_singer(
            recommend_param,
            req.recommend_singer_count,
            req.recommend_song_count,
        )
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];

    match req.source {
        MusicSource::Netesae => {
            for (_singer, songs) in recommend_result {
                for x in songs {
                    if let Some(info) = instance
                        .netesae
                        .client()
                        .search_song(&x.name, &x.singer)
                        .await
                        .map_err(InvokeError::from_anyhow)?
                    {
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

    Ok(ApplicationResp::success_data(RecommendSongResp {
        song_infos: list,
    }))
}
