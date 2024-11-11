use crate::client::resp::GetLoginQrResp;
use crate::client::Client;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use ncm_api::{LoginInfo, MusicApi};

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
            CheckQrCode::Timeout => Err(anyhow!("二维码已过期")),
            CheckQrCode::WaitScan => Err(anyhow!("未扫码")),
            CheckQrCode::WaitConfirm => Err(anyhow!("等待确认中")),
            CheckQrCode::LoginSuccess => self.api.login_status().await,
            CheckQrCode::Unknown => Err(anyhow!("未知码: {}", result.code)),
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
