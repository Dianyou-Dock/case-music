use ncm_api::LoginInfo;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct LoginQrInfo {
    pub url: String,
    pub unikey: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ClientLoginInfoData {
    Netesae(LoginInfo),
}

#[derive(Serialize, Debug, Clone)]
pub struct ClientLoginInfo {
    #[serde(flatten)]
    pub data: ClientLoginInfoData,
}
