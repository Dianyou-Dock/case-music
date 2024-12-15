pub mod impls;

use crate::types::ai_recommend_info::{
    AiRecommendInfo, AiRecommendSingerInfo, AiRecommendSongInfo,
};
use crate::types::constants::AiSource;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Client: Sync + Send {
    async fn recommend_song(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
        previous: Option<Vec<AiRecommendSongInfo>>,
    ) -> Result<AiRecommendInfo>;

    async fn rand_recommends(
        &self,
        data: &[AiRecommendSongInfo],
        count: u64,
    ) -> Result<AiRecommendInfo>;

    /// This recommendation doesn't seem very accurate.
    /// It may be related to different AI platforms and computing models.
    async fn recommend_style(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
        previous: Option<Vec<AiRecommendSongInfo>>,
    ) -> Result<AiRecommendInfo>;

    async fn recommend_singer(
        &self,
        data: AiRecommendSongInfo,
        singer_count: u64,
        song_count: u64,
        previous: Option<Vec<String>>,
    ) -> Result<AiRecommendSingerInfo>;

    fn ai_source(&self) -> AiSource;
}
