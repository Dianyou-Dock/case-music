use crate::application::resp::{ApplicationResp, ListResp};
use crate::application::RecommendationFeedback;
use crate::application::recommendation_engine::Candidate;
use crate::application::recommendation_pipeline;
use crate::types::ai_recommend_info::{AiBenchmarkInfo, AiRecommendSongInfo};
use crate::types::constants::MusicSource;
use crate::types::error::ApplicationError::AiNotUse;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::NotLogin;
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::INSTANCE;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    #[serde(default)]
    pub excluded_artists: Vec<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct RecommendSongResp<T: Serialize + Clone + Debug> {
    pub song_infos: Vec<T>,
    pub benchmark_info: AiBenchmarkInfo,
}

#[derive(Deserialize)]
pub struct ProviderRecommendReq {
    pub source: MusicSource,
    pub song: Option<String>,
    pub singer: Option<String>,
    pub count: usize,
    #[serde(default)]
    pub previous: Vec<AiRecommendSongInfo>,
    #[serde(default)]
    pub excluded_ids: Vec<String>,
    #[serde(default)]
    pub excluded_artists: Vec<String>,
    #[serde(default)]
    pub preferred_samples: Vec<AiRecommendSongInfo>,
}

#[tauri::command]
pub async fn recommend_provider_songs(req: ProviderRecommendReq) -> Result<ApplicationResp<Vec<Value>>, InvokeError> {
    use crate::application::system::{qqmusic, spotify};
    let _task = try_recommend_task()?;
    if req.count == 0 || req.count > 30 { return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid recommendation count"))); }
    if !matches!(req.source, MusicSource::QQ | MusicSource::Spotify) {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Use the NetEase recommendation command for this source")));
    }
    let single_song = req.song.is_some() && req.singer.is_some();
    let excluded_artists: HashSet<_> = req.excluded_artists.iter().map(|artist| artist.trim().to_lowercase()).collect();
    let samples = if single_song {
        vec![AiRecommendSongInfo {
            name: req.song.clone().unwrap(), singer: req.singer.clone().unwrap(), song_type: String::new(),
        }]
    } else {
        let mut tracks: Vec<(String, String)> = match req.source {
            MusicSource::QQ => qqmusic::recommendation_samples().await.map_err(InvokeError::from_anyhow)?
                .into_iter().map(|track| (track.name, track.artists.first().map(|artist| artist.name.clone()).unwrap_or_default())).collect(),
            MusicSource::Spotify => spotify::recommendation_samples().await.map_err(InvokeError::from_anyhow)?
                .into_iter().map(|track| (track["name"].as_str().unwrap_or_default().to_string(), track["artists"][0]["name"].as_str().unwrap_or_default().to_string())).collect(),
            _ => unreachable!(),
        };
        use rand::seq::SliceRandom;
        tracks.shuffle(&mut rand::thread_rng());
        req.preferred_samples.iter().filter(|sample| !sample.name.is_empty() && !sample.singer.is_empty()
            && !excluded_artists.contains(&sample.singer.trim().to_lowercase())).take(5).cloned()
            .chain(tracks.into_iter().filter(|(name, artist)| !name.is_empty() && !artist.is_empty() && !excluded_artists.contains(&artist.trim().to_lowercase()))
                .map(|(name, singer)| AiRecommendSongInfo { name, singer, song_type: String::new() }))
            .take(10).collect()
    };
    let instance = INSTANCE.read().await;
    let ai = instance.ai.as_ref().ok_or_else(|| InvokeError::from_anyhow(AiNotUse.anyhow_err()))?;
    let result = recommendation_pipeline::generate(ai.as_ref(), &samples, req.count as u64, &req.previous, single_song)
        .await.map_err(InvokeError::from_anyhow)?;
    drop(instance);
    let primary_style = result.benchmark.song_type;
    let excluded: HashSet<_> = req.excluded_ids.into_iter().collect();
    let seed_artist = req.singer.unwrap_or_default().trim().to_lowercase();
    let mut candidates = Vec::new();
    let mut tracks = std::collections::HashMap::<String, Value>::new();
    for song in result.recommends {
        let resolved = match req.source {
            MusicSource::QQ => qqmusic::search_recommendation_song(&song.name, &song.singer).await
                .map(|track| track.and_then(|track| serde_json::to_value(track).ok())),
            MusicSource::Spotify => spotify::search_recommendation_song(&song.name, &song.singer).await,
            _ => unreachable!(),
        };
        let track = match resolved {
            Ok(Some(track)) => track,
            Ok(None) => continue,
            Err(error) => {
                log::warn!("Could not search recommended song '{}' by '{}': {error:#}", song.name, song.singer);
                continue;
            }
        };
        let Some(id) = track["id"].as_str() else { continue; };
        if excluded.contains(id) || tracks.contains_key(id) { continue; }
        let artist = song.singer.trim().to_lowercase();
        if excluded_artists.contains(&artist) { continue; }
        let date = if matches!(req.source, MusicSource::QQ) { track["release_date"].as_str() }
            else { track["album"]["release_date"].as_str() };
        let year = date.and_then(|date| date.get(..4)).and_then(|year| year.parse().ok());
        candidates.push(Candidate {
            id: id.to_string(), artist: artist.clone(), year, style: song.song_type,
            familiar_artist: samples.iter().any(|sample| sample.singer.trim().eq_ignore_ascii_case(&artist)),
            seed_artist: !seed_artist.is_empty() && artist == seed_artist,
        });
        tracks.insert(id.to_string(), track);
    }
    let selected = recommendation_pipeline::select(&candidates, req.count, &primary_style);
    let mut songs: Vec<Value> = selected.into_iter().filter_map(|id| tracks.remove(&id)).collect();
    if songs.is_empty() {
        for sample in &samples {
            if songs.len() >= req.count { break; }
            if excluded_artists.contains(&sample.singer.trim().to_lowercase()) { continue; }
            let found = match req.source {
                MusicSource::QQ => qqmusic::search_recommendation_song(&sample.name, &sample.singer).await
                    .ok().flatten().and_then(|track| serde_json::to_value(track).ok()),
                MusicSource::Spotify => spotify::search_recommendation_song(&sample.name, &sample.singer).await.ok().flatten(),
                _ => None,
            };
            if let Some(track) = found { songs.push(track); }
        }
    }
    Ok(ApplicationResp::success_data(songs))
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
    let excluded_artists: HashSet<_> = req.excluded_artists.iter().map(|artist| artist.trim().to_lowercase()).collect();

    let recommend_param = AiRecommendSongInfo {
        name: req.song,
        singer: req.singer,
        song_type: "".to_string(),
    };

    let recommend_result = recommendation_pipeline::generate(
        instance.ai.as_ref().unwrap().as_ref(), &[recommend_param.clone()],
        req.recommend_song_count, &req.previous.unwrap_or_default(), true,
    )
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
                        if excluded_artists.contains(&artist) { continue; }
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
                        if excluded_artists.contains(&artist) { continue; }
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

    let selected = recommendation_pipeline::select(&candidates, req.recommend_song_count as usize, &primary_style);
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
