use ncm_api::SongUrl as NcSongUrl;
use serde::{Deserialize, Serialize};
use strum_macros::Display;

#[derive(Serialize, Deserialize, Debug, Clone, Display)]
pub enum SongRate {
    #[strum(serialize = "128000")]
    L,
    #[strum(serialize = "192000")]
    M,
    #[strum(serialize = "320000")]
    H,
    #[strum(serialize = "999000")]
    SQ,
    #[strum(serialize = "1900000")]
    HR,
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "content")]
pub enum SongUrlData {
    Netesae(NcSongUrl),
}

#[derive(Serialize, Debug, Clone)]
pub struct SongUrl {
    #[serde(flatten)]
    pub data: SongUrlData,
}
