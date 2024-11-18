pub mod impls;

use crate::types::ai_recommend_info::AiRecommendSongInfo;
use anyhow::Result;
use async_trait::async_trait;
use std::collections::BTreeMap;

#[async_trait]
pub trait Client: Sync + Send {
    async fn recommend_song(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
    ) -> Result<Vec<AiRecommendSongInfo>>;

    async fn recommend_style(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
    ) -> Result<Vec<AiRecommendSongInfo>>;

    async fn recommend_singer(
        &self,
        data: AiRecommendSongInfo,
        singer_count: u64,
        song_count: u64,
    ) -> Result<BTreeMap<String, Vec<AiRecommendSongInfo>>>;
}
