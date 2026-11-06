use crate::application::resp::{ApplicationResp, ListResp};
use crate::application::RecommendationFeedback;
use crate::application::recommendation_engine::{self, Candidate};
use crate::types::ai_recommend_info::{AiBenchmarkInfo, AiRecommendSongInfo};
use crate::types::constants::MusicSource;
use crate::types::error::ApplicationError::AiNotUse;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::NotLogin;
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fmt::Debug;
use std::time::Duration;
use tauri::ipc::InvokeError;
use tokio::sync::{Mutex, MutexGuard};
use tokio::time::sleep;

static RECOMMEND_TASK: Mutex<()> = Mutex::const_new(());

fn try_recommend_task() -> Result<MutexGuard<'static, ()>, InvokeError> {
    RECOMMEND_TASK.try_lock().map_err(|_| {
        InvokeError::from_anyhow(anyhow::anyhow!("Recommendation already running"))
    })
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecommendReq {
    pub source: MusicSource,
    pub song: String,
    pub singer: String,
    pub recommend_song_count: u64,
    pub recommend_singer_count: u64,
    pub previous: Option<Vec<AiRecommendSongInfo>>,
    #[serde(default)]
    pub excluded_song_ids: Vec<u64>,
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
    let _task = try_recommend_task()?;
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let seed_artist = req.singer.trim().to_lowercase();
    let excluded_song_ids: HashSet<u64> = req.excluded_song_ids.iter().copied().collect();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
        song_type: "".to_string(),
    };

    let recommend_result = instance.ai.as_ref().unwrap()
        .recommend_song(recommend_param.clone(), req.recommend_song_count, req.previous)
        .await
        .map_err(InvokeError::from_anyhow)?;

    let mut list = vec![];
    let mut map = BTreeMap::new();
    let mut search_error = None;
    let primary_style = recommend_result.benchmark.song_type.clone();
    let mut candidates = vec![];

    match req.source {
        MusicSource::Netesae => {
            for (index, x) in recommend_result.recommends.into_iter().enumerate() {
                if index > 0 {
                    sleep(Duration::from_millis(700)).await;
                }
                match instance
                    .netesae
                    .client()
                    .search_song(&x.name, &x.singer)
                    .await
                {
                    Ok(Some(info)) => {
                        let mut info = info.with_type(x.song_type.clone());
                        let (song_id, album_id, artist) = match &info.data {
                            SongInfoData::Netesae(d) => (d.id, d.album_id, d.singer.trim().to_lowercase()),
                        };
                        if excluded_song_ids.contains(&song_id) { continue; }
                        let release = instance.netesae.client().album_release_date(album_id).await.ok().flatten();
                        if let Some((year, date)) = &release {
                            info.release_year = Some(*year);
                            info.release_date = Some(date.clone());
                        }
                        if map.insert(song_id, info.clone()).is_none() {
                            candidates.push(Candidate {
                                id: song_id, artist: artist.clone(), year: release.map(|(year, _)| year),
                                style: x.song_type, familiar_artist: artist == seed_artist,
                                seed_artist: artist == seed_artist,
                            });
                        }
                    }
                    Ok(None) => {}
                    Err(error) => {
                        log::warn!(
                            "Could not find recommended song '{}' by '{}': {error:#}",
                            x.name,
                            x.singer
                        );
                        search_error = Some(error);
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

    let current_year = time::OffsetDateTime::now_utc().year();
    let mut missing = Vec::new();
    if !candidates.iter().any(|candidate: &Candidate<u64>| candidate.year == Some(current_year)) {
        missing.push(current_year);
    }
    if !candidates.iter().any(|candidate| candidate.year.is_some_and(|year| year <= current_year - 10)) {
        missing.push((current_year - 10) / 10 * 10);
    }
    if !missing.is_empty() && matches!(req.source, MusicSource::Netesae) {
        match instance.ai.as_ref().unwrap().fill_decades(&[recommend_param], &missing).await {
            Ok(extra) => {
                for candidate in extra.recommends {
                    if let Ok(Some(info)) = instance.netesae.client().search_song(&candidate.name, &candidate.singer).await {
                        let mut info = info.with_type(candidate.song_type.clone());
                        let SongInfoData::Netesae(data) = &info.data;
                        let (id, album_id, artist) = (data.id, data.album_id, data.singer.trim().to_lowercase());
                        if map.contains_key(&id) || excluded_song_ids.contains(&id) { continue; }
                        let release = instance.netesae.client().album_release_date(album_id).await.ok().flatten();
                        if let Some((year, date)) = &release {
                            info.release_year = Some(*year);
                            info.release_date = Some(date.clone());
                        }
                        candidates.push(Candidate {
                            id, artist: artist.clone(), year: release.map(|(year, _)| year),
                            style: candidate.song_type, familiar_artist: artist == seed_artist,
                            seed_artist: artist == seed_artist,
                        });
                        map.insert(id, info);
                    }
                }
            }
            Err(error) => log::warn!("Could not fill single-song release years: {error:#}"),
        }
    }

    let selected = recommendation_engine::select_balanced(
        &candidates, req.recommend_song_count as usize, &primary_style, current_year,
    );
    let selected_ids: std::collections::HashSet<_> = selected.iter().copied().collect();
    list = selected.iter().filter_map(|id| map.get(id).cloned()).collect();
    map.retain(|id, _| selected_ids.contains(id));

    if list.is_empty() {
        if let Some(error) = search_error {
            return Ok(ApplicationResp::msg_code(error.to_string(), -2));
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
    let _task = try_recommend_task()?;
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let ai = instance.ai.as_ref().unwrap();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
        song_type: "".to_string(),
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
    let _task = try_recommend_task()?;
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let ai = instance.ai.as_ref().unwrap();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
        song_type: "".to_string(),
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
    feedback: Option<RecommendationFeedback>,
) -> Result<ApplicationResp<ListResp>, InvokeError> {
    let _task = try_recommend_task()?;
    if INSTANCE.read().await.netesae.login_info().is_none() {
        return Err(InvokeError::from_anyhow(NotLogin.anyhow_err()));
    };

    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;
    let like_list_set = instance.netesae.likeds().unwrap();

    if instance.rand_cache.songs.is_empty() {
        // update
        instance
            .refresh_rand_cache(source, &feedback.unwrap_or_default())
            .await
            .map_err(|e| InvokeError::from_anyhow(e))?;
    }

    let songs = instance.rand_cache.songs.clone();
    let mut likeds = vec![];

    for song in &songs {
        let song_id = match &song.data {
            SongInfoData::Netesae(v) => v.id,
        };

        likeds.push(like_list_set.contains(&song_id));
    }

    let total = songs.len();

    Ok(ApplicationResp::success_data(ListResp{
        id: 0,
        name: "Rand Recommend".to_string(),
        cover_img_url: "https://raw.githubusercontent.com/Dianyou-Dock/case-music/refs/heads/main/core/backend/icons/origin.png".to_string(),
        songs,
        likeds,
        total: total as u64,
    }))
}

#[tauri::command]
pub async fn refresh_rand_cache(source: MusicSource, feedback: Option<RecommendationFeedback>) -> Result<ApplicationResp<()>, InvokeError> {
    let _task = try_recommend_task()?;
    if INSTANCE.read().await.ai.is_none() {
        return Err(InvokeError::from_anyhow(AiNotUse.anyhow_err()));
    }

    let mut instance = INSTANCE.write().await;

    instance
        .refresh_rand_cache(source, &feedback.unwrap_or_default())
        .await
        .map_err(InvokeError::from_anyhow)?;

    Ok(ApplicationResp::success())
}
