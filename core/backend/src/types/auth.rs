use crate::types::constants::MusicSource;
use ncm_api::CookieJar;

#[derive(Debug, Clone)]
pub enum AuthData {
    Netesae(CookieJar),
}

#[derive(Debug, Clone)]
pub struct Auth {
    pub source: MusicSource,
    pub data: AuthData,
}
