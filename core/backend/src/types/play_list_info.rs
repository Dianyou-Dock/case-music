use ncm_api::{PlayListDetail, SongList};
use serde::Serialize;
#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "content")]
pub enum PlayListInfoData {
    Netesae(PlayListDetail),
}

#[derive(Serialize, Debug, Clone)]
pub struct PlayListInfo {
    #[serde(flatten)]
    pub data: PlayListInfoData,
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "content")]
pub enum SongListData {
    Netesae(SongList),
}

#[derive(Serialize, Debug, Clone)]
pub struct SongListInfo {
    #[serde(flatten)]
    pub data: SongListData,
}
