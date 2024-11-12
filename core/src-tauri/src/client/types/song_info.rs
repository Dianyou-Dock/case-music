use ncm_api::SongInfo;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ClientSongInfoData {
    Netesae(SongInfo),
}

#[derive(Serialize, Debug, Clone)]
pub struct ClientSongInfo {
    #[serde(flatten)]
    pub data: ClientSongInfoData,
}
