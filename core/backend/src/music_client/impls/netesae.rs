use crate::music_client::Client;
use crate::types::constants::{
    MusicSource, AUTH_DIR, AUTH_FILE, BASE_NETESAE_URL_LIST, DATA_PATH, NETEASE_DOMAIN,
};
use crate::types::error::{ErrorHandle, MusicClientError};
use crate::types::login_info::{LoginInfo, LoginInfoData, LoginQrInfo};
use crate::types::play_list_info::{PlayListInfo, PlayListInfoData, SongListData, SongListInfo};
use crate::types::song_info::{SongInfo, SongInfoData};
use crate::types::song_url::{SongRate, SongUrl, SongUrlData};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use cookie_store::CookieStore;
use ncm_api::{CookieBuilder, CookieJar, MusicApi};
use std::fs;
use std::path::{PathBuf};
use tokio::io::AsyncWriteExt;

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
    auth_file: PathBuf,
    logged: bool,
}

impl NeteaseClient {
    pub fn new() -> Result<NeteaseClient> {
        let auth_data = DATA_PATH
            .join(AUTH_DIR)
            .join(MusicSource::Netesae.to_string());
        if !auth_data.exists() {
            fs::create_dir_all(&auth_data)?;
        }

        let auth_file = auth_data.join(AUTH_FILE);
        let mut logged = false;

        let api = if auth_file.exists() {
            let auth_str = fs::read_to_string(&auth_file)?;
            let cookie_store = serde_json::from_str::<CookieStore>(&auth_str)?;
            let cookie_jar = CookieJar::default();
            for base_url in BASE_NETESAE_URL_LIST {
                let url = base_url.parse()?;
                for c in cookie_store.matches(&url) {
                    let cookie = CookieBuilder::new(c.name(), c.value())
                        .domain(NETEASE_DOMAIN)
                        .path(c.path().unwrap_or("/"))
                        .build()?;
                    cookie_jar.set(cookie, &base_url.parse()?)?;
                }
            }
            logged = true;
            MusicApi::from_cookie_jar(cookie_jar, 100)
        } else {
            MusicApi::new(100)
        };

        Ok(Self { api, auth_file, logged })
    }

    async fn replace_api(&mut self, cookie_jar: CookieJar) -> Result<()> {
        self.save_auth(&cookie_jar).await?;
        let api = MusicApi::from_cookie_jar(cookie_jar, 100);
        self.api = api;
        Ok(())
    }

    async fn save_auth(&self, cookie_jar: &CookieJar) -> Result<()> {
        let mut file = if !self.auth_file.exists() {
            tokio::fs::File::create(&self.auth_file).await?
        } else {
            tokio::fs::File::open(&self.auth_file).await?
        };

        let mut cookie_store = CookieStore::default();

        for base_url in BASE_NETESAE_URL_LIST {
            let uri = &base_url.parse()?;
            let url = &base_url.parse()?;
            for c in cookie_jar.get_for_uri(url) {
                let cookie = cookie_store::Cookie::parse(
                    format!(
                        "{}={}; Path={}; Domain={NETEASE_DOMAIN}; Max-Age=31536000",
                        c.name(),
                        c.value(),
                        url.path()
                    ),
                    uri,
                )?;
                cookie_store.insert(cookie, uri)?;
            }
        }
        let json = serde_json::to_vec(&cookie_store)?;
        file.write_all(&json).await?;

        Ok(())
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

    async fn login_by_unikey(&mut self, unikey: String) -> Result<(i32, Option<LoginInfo>)> {
        println!("unikey: {unikey}");

        let result = self.api.login_qr_check(unikey).await?;

        println!("result: {result:?}");
        let check_qr_code = CheckQrCode::from_i32(result.code);
        match check_qr_code {
            CheckQrCode::Timeout => Ok((MusicClientError::QrTimeout.code(), None)),
            CheckQrCode::WaitScan => Ok((MusicClientError::QrWaitScan.code(), None)),
            CheckQrCode::WaitConfirm => Ok((MusicClientError::QrWaitConfirm.code(), None)),
            CheckQrCode::LoginSuccess => {
                let msg = self.api.login_status().await?;
                let cookie = if msg.code == 200 && self.api.cookie_jar().is_some() {
                    self.api.cookie_jar().unwrap().clone()
                } else {
                    return Err(MusicClientError::LoginFail.anyhow_err());
                };

                self.replace_api(cookie.clone()).await?;

                Ok((
                    0,
                    Some(LoginInfo {
                        data: LoginInfoData::Netesae(msg),
                    }),
                ))
            }
            CheckQrCode::Unknown => Err(MusicClientError::QrUnknown.anyhow_err()),
        }
    }

    async fn logout(&mut self) -> Result<()> {
        tokio::fs::remove_file(&self.auth_file).await?;
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

    async fn collect_list(&mut self, user_id: u64) -> Result<Vec<SongListInfo>> {
        // No one has that many playlists, right?
        let limit = 10000;

        let list_info = self.api.user_song_list(user_id, 1, limit).await?;
        let mut song_list_info = vec![];

        for x in list_info {
            song_list_info.push(SongListInfo {
                data: SongListData::Netesae(x),
            });
        }

        Ok(song_list_info)
    }

    async fn list_detail(&mut self, list_id: u64) -> Result<PlayListInfo> {
        let list_info = self.api.song_list_detail(list_id).await?;
        Ok(PlayListInfo {
            data: PlayListInfoData::Netesae(list_info),
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

    async fn like_song(&mut self, song_id: u64, is_like: bool) -> Result<bool> {
        let result = self.api.like(is_like, song_id).await;
        Ok(result)
    }

    async fn songs_url(&mut self, songs: &[u64], song_rate: SongRate) -> Result<Vec<SongUrl>> {
        let result = self.api.songs_url(songs, &song_rate.to_string()).await?;

        let mut list = vec![];
        for x in result {
            let song_url = SongUrl {
                data: SongUrlData::Netesae(x),
            };
            list.push(song_url);
        }

        Ok(list)
    }

    async fn logged(&mut self) -> bool {
        self.logged
    }

    async fn login_info(&mut self) -> Result<LoginInfo> {
        let info = self.api.login_status().await?;
        Ok(LoginInfo {
            data: LoginInfoData::Netesae(info),
        })
    }
}

#[cfg(test)]
mod test {
    use crate::music_client::impls::netesae::NeteaseClient;
    use crate::music_client::Client;
    use crate::types::login_info::LoginInfo;
    use crate::types::song_url::SongRate;
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
                Ok((code,info)) => {
                    println!("login info: {info:?}");
                    if code == 0 {
                        let info = info.unwrap();
                        return Ok(info);
                    }

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
            qrcode_generator::to_png_to_file(&result.url, QrCodeEcc::Low, 140, "./qr.file")
                .unwrap();
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
    fn test_login_status() {
        runtime().block_on(async {
            let mut client = NeteaseClient::new().unwrap();
            let info = client.api.login_status().await.unwrap();
            println!("{info:?}");
        });
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

    #[test]
    fn test_song_url() {
        runtime().block_on(async {
            let mut client = NeteaseClient::new().unwrap();

            // login(&mut client).await.unwrap();

            let song_list = vec![480097437];

            let songs_url = client.songs_url(&song_list, SongRate::L).await.unwrap();

            println!("songs url: {:?}", songs_url);
        });
    }
}
