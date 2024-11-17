use ncm_api::LoginInfo as NcLoginInfo;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct LoginQrInfo {
    pub url: String,
    pub unikey: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", content = "content")]
pub enum LoginInfoData {
    Netesae(NcLoginInfo),
}

#[derive(Serialize, Debug, Clone)]
pub struct LoginInfo {
    #[serde(flatten)]
    pub data: LoginInfoData,
}
