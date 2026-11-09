use crate::ai_client::Client as AiClient;
use crate::application::recommendation_engine::{self, Candidate};
use crate::types::ai_recommend_info::{AiRecommendInfo, AiRecommendSongInfo};
use anyhow::Result;
use std::hash::Hash;

/// The provider supplies examples and resolves real tracks; generation, independent
/// review (inside the AI client), and final style-balanced selection are shared.
pub async fn generate(
    ai: &dyn AiClient,
    samples: &[AiRecommendSongInfo],
    count: u64,
    previous: &[AiRecommendSongInfo],
    single_song: bool,
) -> Result<AiRecommendInfo> {
    if single_song {
        let sample = samples.first().ok_or_else(|| anyhow::anyhow!("A sample song is required"))?;
        ai.recommend_song(sample.clone(), count, Some(previous.to_vec())).await
    } else {
        ai.rand_recommends(samples, count, previous).await
    }
}

pub fn select<Id: Clone + Eq + Hash>(
    candidates: &[Candidate<Id>], count: usize, style: &str,
) -> Vec<Id> {
    recommendation_engine::select_balanced(
        candidates, count, style, time::OffsetDateTime::now_utc().year(),
    )
}
