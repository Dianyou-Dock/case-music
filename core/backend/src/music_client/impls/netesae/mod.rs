use crate::music_client::Client;
use crate::types::error::{ErrorHandle, MusicClientError};
use crate::types::login_info::{LoginInfo, LoginInfoData, LoginQrInfo};
use crate::types::play_list_info::{PlayListInfo, PlayListInfoData};
use crate::types::song_info::{SongInfo, SongInfoData};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use ncm_api::{CookieJar, MusicApi};

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
    async fn login_qr(&mut self) -> Result<LoginQrInfo> {
        let result = self.api.login_qr_create().await?;
        Ok(LoginQrInfo {
            url: result.0,
            unikey: result.1,
        })
    }

    async fn login_by_unikey(&mut self, unikey: String) -> Result<LoginInfo> {
        let result = self.api.login_qr_check(unikey).await?;

        let check_qr_code = CheckQrCode::from_i32(result.code);
        match check_qr_code {
            CheckQrCode::Timeout => Err(MusicClientError::QrTimeout.anyhow_err()),
            CheckQrCode::WaitScan => Err(MusicClientError::QrWaitScan.anyhow_err()),
            CheckQrCode::WaitConfirm => Err(MusicClientError::QrWaitConfirm.anyhow_err()),
            CheckQrCode::LoginSuccess => {
                let msg = self.api.login_status().await?;
                let cookie = if msg.code == 200 && self.api.cookie_jar().is_some() {
                    self.api.cookie_jar().unwrap().clone()
                } else {
                    return Err(MusicClientError::LoginFail.anyhow_err());
                };

                self.replace_api(cookie.clone());

                Ok(LoginInfo {
                    data: LoginInfoData::Netesae(msg),
                })
            }
            CheckQrCode::Unknown => Err(MusicClientError::QrUnknown.anyhow_err()),
        }
    }

    async fn logout(&mut self) -> Result<()> {
        Ok(self.api.logout().await)
    }

    async fn like_list(&mut self, user_id: u64) -> Result<PlayListInfo> {
        let like_list_infos = self.api.user_song_list(user_id, 0, 1).await?;

        let Some(like_list) = like_list_infos.get(0) else {
            return Err(MusicClientError::UserSongListIsNull.anyhow_err());
        };

        let play_list_info = self.api.song_list_detail(like_list.id).await?;
        Ok(PlayListInfo {
            data: PlayListInfoData::Netesae(play_list_info),
        })
    }

    async fn song_infos(&mut self, song_id_list: &[u64]) -> Result<Vec<SongInfo>> {
        let result = self.api.songs_detail(song_id_list).await?;

        let mut song_infos = vec![];

        for si in result {
            let csi = SongInfo {
                data: SongInfoData::Netesae(si),
            };
            song_infos.push(csi);
        }

        Ok(song_infos)
    }

    async fn search_song(&mut self, song: &str, singer: &str) -> Result<Option<SongInfo>> {
        let search_info = format!("{song} {singer}");
        let limit = 50;
        let mut offset = 0;
        let mut song_info = None;

        loop {
            let result = self
                .api
                .search_song(search_info.clone(), offset, limit)
                .await?;

            if result.len() == 0 {
                break;
            }

            for x in result {
                if x.singer.eq(singer) && x.name.eq(song) {
                    song_info = Some(x);
                    break;
                }
            }

            offset += limit;
        }

        if let Some(song_info) = song_info {
            Ok(Some(SongInfo {
                data: SongInfoData::Netesae(song_info),
            }))
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod test {
    use crate::music_client::impls::netesae::NeteaseClient;
    use crate::music_client::Client;
    use crate::types::login_info::LoginInfo;
    use anyhow::Result;
    use qrcode_generator::QrCodeEcc;
    use std::time::Duration;
    use tokio::time::sleep;

    fn runtime() -> tokio::runtime::Runtime {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt
    }

    async fn login(client: &mut NeteaseClient) -> Result<LoginInfo> {
        let result = client.login_qr().await.unwrap();
        qrcode_generator::to_png_to_file(&result.url, QrCodeEcc::Low, 140, "./qr.file")?;

        println!("qr info: {:?}", result);

        loop {
            sleep(Duration::from_secs(10)).await;

            let resp = client.login_by_unikey(result.unikey.clone()).await;

            match resp {
                Ok(info) => {
                    println!("login info: {info:?}");
                    return Ok(info);
                }
                Err(e) => {
                    println!("login error: {e}");
                    continue;
                }
            }
        }
    }

    #[test]
    fn test_login_by_qr() {
        runtime().block_on(async {
            let mut client = NeteaseClient::new().unwrap();
            let result = client.login_qr().await.unwrap();

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

    #[test]
    fn test_like_list() {
        runtime().block_on(async {
            let mut client = NeteaseClient::new().unwrap();

            let like_list = client.like_list(450442025).await.unwrap();

            println!("like list: {:?}", like_list);
        });
    }

    #[test]
    fn test_song_info() {
        runtime().block_on(async {
            let mut client = NeteaseClient::new().unwrap();

            let like_list = vec![480097437];

            let like_songs = client.song_infos(&like_list).await.unwrap();

            println!("like songs: {:?}", like_songs);
        });
    }
}
