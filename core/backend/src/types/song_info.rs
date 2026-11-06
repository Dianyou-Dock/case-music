use ncm_api::SongInfo as NcSongInfo;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "content")]
pub enum SongInfoData {
    Netesae(NcSongInfo),
}

#[derive(Serialize, Debug, Clone)]
pub struct SongInfo {
    #[serde(flatten)]
    pub data: SongInfoData,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub song_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_year: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
}

impl SongInfo {
    pub fn with_type(mut self, song_type: String) -> Self {
        if !song_type.trim().is_empty() { self.song_type = Some(song_type); }
        self
    }
}
