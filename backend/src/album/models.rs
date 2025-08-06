use serde::{Deserialize, Serialize};
use crate::artists::models::{Artist, Image, ExternalUrls};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Album {
    pub album_type: String,
    pub artists: Vec<Artist>,
    #[serde(default)]
    pub available_markets: Vec<String>,
    pub external_urls: ExternalUrls,
    pub href: String,
    pub id: String,
    pub images: Vec<Image>,
    pub name: String,
    pub release_date: String,
    pub release_date_precision: String,
    pub total_tracks: i32,
    #[serde(rename = "type")]
    pub album_type_name: String,
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlbumResponse {
    pub album_type: String,
    pub artists: Vec<Artist>,
    #[serde(default)]
    pub available_markets: Vec<String>,
    pub copyrights: Vec<Copyright>,
    pub external_ids: ExternalIds,
    pub external_urls: ExternalUrls,
    pub genres: Vec<String>,
    pub href: String,
    pub id: String,
    pub images: Vec<Image>,
    pub label: String,
    pub name: String,
    pub popularity: i32,
    pub release_date: String,
    pub release_date_precision: String,
    pub total_tracks: i32,
    pub tracks: Tracks,
    #[serde(rename = "type")]
    pub album_type_name: String,
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Copyright {
    pub text: String,
    #[serde(rename = "type")]
    pub copyright_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ExternalIds {
    #[serde(default)]
    pub isrc: Option<String>,
    #[serde(default)]
    pub ean: Option<String>,
    #[serde(default)]
    pub upc: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tracks {
    pub href: String,
    pub items: Vec<crate::tracks::models::Track>,
    pub limit: i32,
    pub next: Option<String>,
    pub offset: i32,
    pub previous: Option<String>,
    pub total: i32,
}

// 获取专辑信息的响应
#[derive(Debug, Serialize, Deserialize)]
pub struct GetAlbumResponse {
    pub success: bool,
    pub message: String,
    pub album: Option<AlbumResponse>,
}

// 获取专辑的曲目响应
#[derive(Debug, Serialize, Deserialize)]
pub struct GetAlbumTracksResponse {
    pub success: bool,
    pub message: String,
    pub tracks: Option<Tracks>,
} 