use crate::ai_client::impls::kimi::ChatClient;
use crate::ai_client::Client as AiClient;
use crate::modules::impls::netesae::NetesaeModule;
use crate::modules::MusicModule;
use crate::types::ai_recommend_info::AiRecommendSongInfo;
use crate::types::constants::{
    data_path, AiSource, MusicSource, ACTIVE_AI_SOURCE_FILE, RAND_RECOMMENDS_BENCHMARK_COUNT, RAND_RECOMMENDS_COUNT,
};
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::LikeListNotExist;
use crate::types::play_list_info::{PlayListInfo, PlayListInfoData};
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::utils;
use anyhow::Result;
use err_logging::ctx;
use err_logging::error_logging::ErrorLogging;
use log::{error, info};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::PathBuf;
use serde::Deserialize;
use tokio::time::Instant;

pub mod ai;
pub mod recommendation_engine;
pub mod recommendation_pipeline;

pub mod music;

mod resp;
pub mod system;

#[derive(Default)]
pub struct RandCache {
    pub songs: Vec<SongInfo>,
}

#[derive(Default, Deserialize, Clone)]
pub struct RecommendationFeedback {
    #[serde(default)]
    pub liked: Vec<u64>,
    #[serde(default)]
    pub completed: Vec<u64>,
    #[serde(default)]
    pub skipped: Vec<u64>,
    #[serde(default)]
    pub excluded_song_ids: Vec<u64>,
    #[serde(default)]
    pub excluded_artists: Vec<String>,
    #[serde(default)]
    pub recently_recommended: Vec<AiRecommendSongInfo>,
}

pub struct Application {
    pub netesae: Box<dyn MusicModule>,
    pub ai: Option<Box<dyn AiClient>>,
    pub data_path: PathBuf,
    pub history_recommends: BTreeMap<u64, SongInfo>,
    pub current_recommends: BTreeMap<u64, SongInfo>,
    pub rand_cache: RandCache,
    pub playlist_cache: HashMap<u64, PlayListInfo>,
}

impl Application {
    pub fn new(netesae: NetesaeModule) -> Application {
        let mut app = Application {
            netesae: Box::new(netesae),
            ai: None,
            data_path: data_path().clone(),
            history_recommends: BTreeMap::new(),
            current_recommends: BTreeMap::new(),
            rand_cache: RandCache::default(),
            playlist_cache: HashMap::new(),
        };

        let selected = std::fs::read_to_string(data_path().join(ACTIVE_AI_SOURCE_FILE))
            .ok()
            .and_then(|value| serde_json::from_str::<AiSource>(&value).ok())
            .unwrap_or(AiSource::Kimi);
        if let Ok(Some(client)) = ChatClient::load_for(selected) {
            app.ai = Some(Box::new(client));
        }

        app
    }

    pub async fn refresh_rand_cache(&mut self, source: MusicSource, feedback: &RecommendationFeedback) -> Result<()> {
        let list = match source {
            MusicSource::Netesae => {
                if self.netesae.like_list().is_none() {
                    return Err(LikeListNotExist.anyhow_err());
                }

                let like_list_info = self.netesae.like_list().unwrap();
                let like_list = match &like_list_info.data {
                    PlayListInfoData::Netesae(v) => v.songs.clone(),
                };
                let mut bench_mark_list = vec![];
                let mut selected = HashSet::new();
                let skipped: HashSet<_> = feedback.skipped.iter().chain(&feedback.excluded_song_ids).copied().collect();
                let excluded_artists: HashSet<_> = feedback.excluded_artists.iter().map(|artist| artist.trim().to_lowercase()).collect();
                for id in &feedback.liked {
                    if bench_mark_list.len() >= RAND_RECOMMENDS_BENCHMARK_COUNT / 2 { break; }
                    if !skipped.contains(id) {
                        if let Some(song) = like_list.iter().find(|song| song.id == *id && !excluded_artists.contains(&song.singer.trim().to_lowercase())) {
                            if selected.insert(*id) { bench_mark_list.push(song.clone()); }
                        }
                    }
                }
                let completed_ids: Vec<_> = feedback.liked.iter().chain(feedback.completed.iter()).copied()
                    .filter(|id| !selected.contains(id) && !skipped.contains(id))
                    .take(RAND_RECOMMENDS_BENCHMARK_COUNT / 2)
                    .collect();
                if !completed_ids.is_empty() {
                    if let Ok(completed_songs) = self.netesae.client().song_infos(&completed_ids).await {
                        for info in completed_songs {
                            let SongInfoData::Netesae(song) = info.data;
                            if bench_mark_list.len() >= RAND_RECOMMENDS_BENCHMARK_COUNT / 2 { break; }
                            if !excluded_artists.contains(&song.singer.trim().to_lowercase()) && selected.insert(song.id) { bench_mark_list.push(song); }
                        }
                    }
                }
                for idx in utils::random_num(like_list.len(), like_list.len()) {
                    if bench_mark_list.len() >= RAND_RECOMMENDS_BENCHMARK_COUNT { break; }
                    let song = &like_list[idx];
                    if !skipped.contains(&song.id) && !excluded_artists.contains(&song.singer.trim().to_lowercase()) && selected.insert(song.id) {
                        bench_mark_list.push(song.clone());
                    }
                }

                let mut recommends_req = vec![];
                for song in &bench_mark_list {
                    let recommend_req = AiRecommendSongInfo {
                        name: song.name.clone(),
                        singer: song.singer.clone(),
                        song_type: "".to_string(),
                    };

                    recommends_req.push(recommend_req);
                }

                let ai = self.ai.as_ref().unwrap();

                let start = Instant::now();
                let recommend_result = recommendation_pipeline::generate(
                    ai.as_ref(), &recommends_req, RAND_RECOMMENDS_COUNT as u64,
                    &feedback.recently_recommended, false,
                )
                    .await
                    .elog(ctx!())?;
                let duration = start.elapsed();
                info!("recommend duration sec: {}", duration.as_secs());

                let mut candidates = vec![];
                let mut candidate_artists = HashMap::<u64, String>::new();
                let mut artist_counts = HashMap::<String, usize>::new();
                let mut seen_songs = HashSet::new();
                let mut song_types = HashMap::<u64, String>::new();
                let mut album_dates = HashMap::<u64, Option<(i32, String)>>::new();
                let mut release_dates = HashMap::<u64, Option<(i32, String)>>::new();

                info!("recommend_result: {recommend_result:?}");

                let start = Instant::now();
                let primary_style = recommend_result.benchmark.song_type.clone();
                let familiar_artists: HashSet<_> = like_list.iter().map(|song| song.singer.trim().to_lowercase()).collect();
                let mut pending = recommend_result.recommends;
                for pass in 0..2 {
                for recommend_info in pending {
                    let artist = recommend_info.singer.trim().to_lowercase();
                    if artist_counts.get(&artist).copied().unwrap_or(0) >= 2 || excluded_artists.contains(&artist) { continue; }
                    let result = self
                        .netesae
                        .client()
                        .search_song(&recommend_info.name, &recommend_info.singer)
                        .await;

                    match result {
                        Ok(song_info) => {
                            if let Some(v) = song_info {
                                let (song_id, album_id) = match &v.data {
                                    SongInfoData::Netesae(v) => (v.id, v.album_id),
                                };

                                if !skipped.contains(&song_id) && seen_songs.insert(song_id) {
                                    *artist_counts.entry(artist.clone()).or_default() += 1;
                                    song_types.insert(song_id, recommend_info.song_type);
                                    let date = if let Some(date) = album_dates.get(&album_id) {
                                        date.clone()
                                    } else {
                                        let date = self.netesae.client().album_release_date(album_id).await.ok().flatten();
                                        album_dates.insert(album_id, date.clone());
                                        date
                                    };
                                    let year = date.as_ref().map(|(year, _)| *year);
                                    release_dates.insert(song_id, date);
                                    candidate_artists.insert(song_id, artist.clone());
                                    candidates.push((song_id, year));
                                }
                            }
                        }
                        Err(e) => {
                            error!("recommend_error: {e}");
                            continue;
                        }
                    }
                }
                if pass == 1 { break; }
                let present: HashSet<i32> = candidates.iter().filter_map(|(_, year)| year.map(|year| year / 10 * 10)).collect();
                let current_year = time::OffsetDateTime::now_utc().year();
                let mut missing: Vec<i32> = (1960..=(current_year / 10 * 10)).step_by(10).filter(|decade| !present.contains(decade)).collect();
                if !candidates.iter().any(|(_, year)| *year == Some(current_year)) { missing.push(current_year); }
                if missing.is_empty() { break; }
                pending = match self.ai.as_ref().unwrap().fill_decades(&recommends_req, &missing).await {
                    Ok(extra) => extra.recommends,
                    Err(error) => {
                        log::warn!("Could not fill missing release decades: {error:#}");
                        break;
                    }
                };
                }
                let duration = start.elapsed();
                info!("reach songs duration: {}", duration.as_secs());

                let ranked = candidates.iter().map(|(id, year)| {
                    let artist = candidate_artists.get(id).cloned().unwrap_or_default();
                    recommendation_engine::Candidate {
                        id: *id,
                        familiar_artist: familiar_artists.contains(&artist),
                        seed_artist: false,
                        style: song_types.get(id).cloned().unwrap_or_default(),
                        artist,
                        year: *year,
                    }
                }).collect::<Vec<_>>();
                let mut songs_id = recommendation_pipeline::select(&ranked, RAND_RECOMMENDS_COUNT, &primary_style);
                if songs_id.is_empty() {
                    songs_id = bench_mark_list.iter().filter(|song| !skipped.contains(&song.id))
                        .take(RAND_RECOMMENDS_COUNT).map(|song| song.id).collect();
                }

                let mut songs_info = if !songs_id.is_empty() {
                    self.netesae
                        .client()
                        .song_infos(&songs_id)
                        .await
                        .elog(ctx!())?
                } else {
                    vec![]
                };

                for song in &mut songs_info {
                    let SongInfoData::Netesae(data) = &song.data;
                    if let Some(song_type) = song_types.remove(&data.id) {
                        if !song_type.trim().is_empty() { song.song_type = Some(song_type); }
                    }
                    if let Some(Some((year, date))) = release_dates.get(&data.id) {
                        song.release_year = Some(*year);
                        song.release_date = Some(date.clone());
                    }
                }

                info!("refresh_rand_cache songs info: {songs_info:?}");

                songs_info
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

        let rc = RandCache { songs: list };

        self.rand_cache = rc;

        Ok(())
    }
}
