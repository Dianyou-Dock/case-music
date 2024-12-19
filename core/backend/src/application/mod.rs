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
use std::collections::BTreeMap;
use std::path::PathBuf;

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
    pub update_rand_cache: bool,
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
            update_rand_cache: false,
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

                let mut recommends = vec![];
                for song in bench_mark_list {
                    let recommend_req = AiRecommendSongInfo {
                        name: song.name,
                        singer: song.singer,
                    };

                    recommends.push(recommend_req);
                }

                let ai = self.ai.as_ref().unwrap();
                let recommend_result = ai
                    .rand_recommends(&recommends, RAND_RECOMMENDS_COUNT as u64)
                    .await?;

                let mut songs_id = vec![];
                let mut likeds = vec![];

                println!("recommend_result: {recommend_result:?}");
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
                            println!("recommend_error: {e}");
                            continue;
                        }
                    }
                }

                let songs_info = self.netesae.client().song_infos(&songs_id).await?;

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
