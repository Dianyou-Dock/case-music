use crate::client::resp::GetLoginQrResp;
use crate::client::Client;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use error::NetesaeError;
use ncm_api::{CookieJar, LoginInfo, MusicApi};

pub mod error;

pub enum CheckQrCode {
    Timeout,
    WaitScan,
    WaitConfirm,
    LoginSuccess,
    Unknown,
}

impl CheckQrCode {
    pub fn from_i32(code: i32) -> CheckQrCode {
        match code {
            800 => CheckQrCode::Timeout,
            801 => CheckQrCode::WaitScan,
            802 => CheckQrCode::WaitConfirm,
            803 => CheckQrCode::LoginSuccess,
            _ => CheckQrCode::Unknown,
        }
    }

    pub fn to_i32(&self) -> Result<i32> {
        match self {
            CheckQrCode::Timeout => Ok(800),
            CheckQrCode::WaitScan => Ok(801),
            CheckQrCode::WaitConfirm => Ok(802),
            CheckQrCode::LoginSuccess => Ok(803),
            CheckQrCode::Unknown => Err(anyhow!("unknown code")),
        }
    }
}

pub struct NeteaseClient {
    api: MusicApi,
}

impl NeteaseClient {
    pub fn new() -> Result<NeteaseClient> {
        let api = MusicApi::new(100);

        Ok(NeteaseClient { api })
    }

    fn replace_api(&mut self, cookie: CookieJar) {
        let api = MusicApi::from_cookie_jar(cookie, 100);
        self.api = api;
    }
}

#[async_trait]
impl Client for NeteaseClient {
    async fn get_login_qr(&mut self) -> Result<GetLoginQrResp> {
        let result = self.api.login_qr_create().await?;
        Ok(GetLoginQrResp {
            url: result.0,
            unikey: result.1,
        })
    }

    async fn login_by_unikey(&mut self, unikey: String) -> Result<LoginInfo> {
        let result = self.api.login_qr_check(unikey).await?;

        let check_qr_code = CheckQrCode::from_i32(result.code);
        match check_qr_code {
            CheckQrCode::Timeout => Err(NetesaeError::QrTimeout.anyhow_err()),
            CheckQrCode::WaitScan => Err(NetesaeError::QrWaitScan.anyhow_err()),
            CheckQrCode::WaitConfirm => Err(NetesaeError::QrWaitConfirm.anyhow_err()),
            CheckQrCode::LoginSuccess => {
                let msg = self.api.login_status().await?;
                let cookie = if msg.code == 200 && self.api.cookie_jar().is_some() {
                    self.api.cookie_jar().unwrap().clone()
                } else {
                    return Err(NetesaeError::LoginFail.anyhow_err());
                };

                self.replace_api(cookie.clone());

                Ok(msg)
            }
            CheckQrCode::Unknown => Err(NetesaeError::QrUnknown.anyhow_err()),
        }
    }

    async fn logout(&mut self) -> Result<()> {
        Ok(self.api.logout().await)
    }
}

#[cfg(test)]
mod test {
    use crate::client::impls::netesae_cloud::NeteaseClient;
    use crate::client::Client;
    use std::time::Duration;
    use tokio::time::sleep;

    fn runtime() -> tokio::runtime::Runtime {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt
    }

    #[test]
    fn test_login_by_qr() {
        runtime().block_on(async {
            let mut client = NeteaseClient::new().unwrap();
            let result = client.get_login_qr().await.unwrap();

            println!("qr info: {:?}", result);

            loop {
                sleep(Duration::from_secs(10)).await;

                let resp = client.login_by_unikey(result.unikey.clone()).await;

                match resp {
                    Ok(info) => {
                        println!("login info: {info:?}");
                        break;
                    }
                    Err(e) => {
                        println!("login error: {e}");
                        continue;
                    }
                }
            }
        })
    }
}
