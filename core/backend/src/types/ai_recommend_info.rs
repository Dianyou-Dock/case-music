use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize , Debug, Clone)]
pub struct AiRecommendSongInfo {
    pub name: String,
    pub singer: String,
}