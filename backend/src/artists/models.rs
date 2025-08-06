use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artist {
    pub external_urls: ExternalUrls,
    pub href: String,
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub artist_type: String,
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExternalUrls {
    pub spotify: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArtistResponse {
    pub external_urls: ExternalUrls,
    pub followers: Followers,
    pub genres: Vec<String>,
    pub href: String,
    pub id: String,
    pub images: Vec<Image>,
    pub name: String,
    pub popularity: i32,
    #[serde(rename = "type")]
    pub artist_type: String,
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Followers {
    pub href: Option<String>,
    pub total: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Image {
    pub url: String,
    pub height: i32,
    pub width: i32,
}

// 获取艺术家信息的响应
#[derive(Debug, Serialize, Deserialize)]
pub struct GetArtistResponse {
    pub success: bool,
    pub message: String,
    pub artist: Option<ArtistResponse>,
}

// 获取艺术家的热门曲目响应
#[derive(Debug, Serialize, Deserialize)]
pub struct GetArtistTopTracksResponse {
    pub success: bool,
    pub message: String,
    pub tracks: Option<Vec<crate::tracks::models::Track>>,
}

// 获取艺术家的相关艺术家响应
#[derive(Debug, Serialize, Deserialize)]
pub struct GetRelatedArtistsResponse {
    pub success: bool,
    pub message: String,
    pub artists: Option<Vec<ArtistResponse>>,
} 