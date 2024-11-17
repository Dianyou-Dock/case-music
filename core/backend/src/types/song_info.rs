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
}
