use serde::{Deserialize, Serialize};
use crate::artists::models::{Artist, ExternalUrls};
use crate::album::models::{Album, ExternalIds};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedTrack {
    pub added_at: String,
    pub track: Track,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Track {
    pub album: Album,
    pub artists: Vec<Artist>,
    #[serde(default)]
    pub available_markets: Vec<String>,
    pub disc_number: i32,
    pub duration_ms: i32,
    pub explicit: bool,
    #[serde(default)]
    pub external_ids: ExternalIds,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub id: String,
    pub is_local: bool,
    pub name: String,
    pub popularity: i32,
    #[serde(default)]
    pub preview_url: Option<String>,
    pub track_number: i32,
    #[serde(rename = "type")]
    pub track_type: String,
    pub uri: String,
    #[serde(default)]
    pub liked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Restrictions {
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedTracksResponse {
    pub href: String,
    pub limit: i32,
    pub next: Option<String>,
    pub offset: i32,
    pub previous: Option<String>,
    pub total: i32,
    pub items: Vec<SavedTrack>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetSavedTracksResponse {
    pub success: bool,
    pub message: String,
    pub tracks: Option<Vec<SavedTrack>>,
    pub total: Option<i32>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub next: Option<String>,
    pub previous: Option<String>,
}

// 用于获取单个歌曲详情的响应模型
#[derive(Debug, Serialize, Deserialize)]
pub struct GetTrackResponse {
    pub success: bool,
    pub message: String,
    pub track: Option<Track>,
    pub playable_track: Option<crate::tracks::details::PlayableTrack>,
}

// 用于收藏/取消收藏歌曲的响应模型
#[derive(Debug, Serialize, Deserialize)]
pub struct LikeTrackResponse {
    pub success: bool,
    pub message: String,
} 