use ncm_api::PlayListDetail;
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
