use crate::ai_client::impls::kimi::Kimi;
use crate::ai_client::Client as AiClient;
use crate::modules::impls::netesae::NetesaeModule;
use crate::modules::MusicModule;
use crate::types::ai_recommend_info::AiRecommendSongInfo;
use crate::types::constants::{
    MusicSource, DATA_PATH, RAND_RECOMMENDS_BENCHMARK_COUNT, RAND_RECOMMENDS_COUNT,
};
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::LikeListNotExist;
use crate::types::play_list_info::PlayListInfoData;
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::utils;
use anyhow::Result;
use err_logging::ctx;
use err_logging::error_logging::ErrorLogging;
use log::{error, info};
use std::collections::BTreeMap;
use std::path::PathBuf;
use tokio::time::Instant;

pub mod ai;

pub mod music;

mod resp;
pub mod system;

#[derive(Default)]
pub struct RandCache {
    pub songs: Vec<SongInfo>,
}

pub struct Application {
    pub netesae: Box<dyn MusicModule>,
    pub ai: Option<Box<dyn AiClient>>,
    pub data_path: PathBuf,
    pub history_recommends: BTreeMap<u64, SongInfo>,
    pub current_recommends: BTreeMap<u64, SongInfo>,
    pub rand_cache: RandCache,
}

impl Application {
    pub fn new(netesae: NetesaeModule) -> Application {
        let mut app = Application {
            netesae: Box::new(netesae),
            ai: None,
            data_path: DATA_PATH.clone(),
            history_recommends: BTreeMap::new(),
            current_recommends: BTreeMap::new(),
            rand_cache: RandCache::default(),
        };

        // TODO:
        // Kimi is used temporarily here.
        // It will become variable after adding new configuration files.
        // Of course, Kimi is still the default.
        let kimi = Kimi::load().unwrap();
        kimi.map(|v| app.ai.replace(Box::new(v)));

        app
    }

    pub async fn refresh_rand_cache(&mut self, source: MusicSource) -> Result<()> {
        let (list, _likeds) = match source {
            MusicSource::Netesae => {
                if self.netesae.like_list().is_none() {
                    return Err(LikeListNotExist.anyhow_err());
                }

                let like_list_info = self.netesae.like_list().unwrap();
                let like_list = match &like_list_info.data {
                    PlayListInfoData::Netesae(v) => v.songs.clone(),
                };
                let like_list_set = self.netesae.likeds().unwrap();

                let len = like_list.len();
                let bench_mark_idxs = utils::random_num(len, RAND_RECOMMENDS_BENCHMARK_COUNT);

                let mut bench_mark_list = vec![];
                for idx in bench_mark_idxs {
                    if let Some(song) = like_list.get(idx) {
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
                let recommend_result = ai
                    .rand_recommends(&recommends_req, RAND_RECOMMENDS_COUNT as u64)
                    .await
                    .elog(ctx!())?;
                let duration = start.elapsed();
                info!("recommend duration sec: {}", duration.as_secs());

                let mut songs_id = vec![];
                let mut likeds = vec![];

                info!("recommend_result: {recommend_result:?}");

                let start = Instant::now();
                for recommend_info in recommend_result.recommends {
                    let result = self
                        .netesae
                        .client()
                        .search_song(&recommend_info.name, &recommend_info.singer)
                        .await;

                    match result {
                        Ok(song_info) => {
                            if let Some(v) = song_info {
                                let song_id = match &v.data {
                                    SongInfoData::Netesae(v) => v.id,
                                };

                                likeds.push(like_list_set.contains(&song_id));
                                songs_id.push(song_id);
                            }
                        }
                        Err(e) => {
                            error!("recommend_error: {e}");
                            continue;
                        }
                    }
                }
                let duration = start.elapsed();
                info!("reach songs duration: {}", duration.as_secs());

                let mut songs_info = if !songs_id.is_empty() {
                    self.netesae
                        .client()
                        .song_infos(&songs_id)
                        .await
                        .elog(ctx!())?
                } else {
                    vec![]
                };

                for (idx, si) in bench_mark_list.into_iter().enumerate() {
                    songs_info.insert(idx, SongInfo{ data: SongInfoData::Netesae(si) });
                }

                info!("refresh_rand_cache songs info: {songs_info:?}");

                (songs_info, likeds)
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
