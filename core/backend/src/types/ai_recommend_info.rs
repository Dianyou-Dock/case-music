use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiRecommendSongInfo {
    pub name: String,
    pub singer: String,
    pub song_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiRecommendSongData {
    pub name: String,
    pub singer: String,
    pub song_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiBenchmarkInfo {
    pub song_type: String,
    pub song_detail: String,
    pub recommend_detail: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiRecommendInfo {
    pub recommends: Vec<AiRecommendSongInfo>,
    pub benchmark: AiBenchmarkInfo,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiRecommendSingerInfo {
    pub benchmark: AiBenchmarkInfo,
    pub recommends: HashMap<String, Vec<AiRecommendSongInfo>>,
}
