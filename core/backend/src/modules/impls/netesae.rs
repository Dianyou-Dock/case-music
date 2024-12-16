use crate::modules::MusicModule;
use crate::music_client::impls::netesae::NeteaseClient;
use crate::music_client::Client;
use crate::types::constants::MusicSource;
use crate::types::login_info::LoginInfo;
use crate::types::play_list_info::{PlayListInfo, PlayListInfoData};
use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashSet;

pub struct NetesaeModule {
    client: Box<dyn Client>,
    like_list: Option<PlayListInfo>,
    user_info: Option<LoginInfo>,
    likeds: Option<HashSet<u64>>,
}

impl NetesaeModule {
    pub fn new() -> Result<Self> {
        let netesae_client = NeteaseClient::new()?;
        Ok(Self {
            client: Box::new(netesae_client),
            like_list: None,
            user_info: None,
            likeds: None,
        })
    }
}

#[async_trait]
impl MusicModule for NetesaeModule {
    fn source(&mut self) -> MusicSource {
        MusicSource::Netesae
    }

    fn client(&mut self) -> &mut dyn Client {
        &mut *self.client
    }

    fn like_list(&mut self) -> Option<&mut PlayListInfo> {
        if self.like_list.is_none() {
            return None;
        }

        let like_list = self.like_list.as_mut().unwrap();

        Some(like_list)
    }

    fn set_like_list(&mut self, like_list: PlayListInfo) -> Result<()> {
        let list = match &like_list.data {
            PlayListInfoData::Netesae(v) => {
                v.songs.iter().map(|song| song.id).collect::<HashSet<u64>>()
            }
        };

        self.like_list = Some(like_list);
        self.likeds = Some(list);

        Ok(())
    }

    fn login_info(&self) -> Option<LoginInfo> {
        self.user_info.clone()
    }

    fn set_login_info(&mut self, login_info: LoginInfo) {
        self.user_info.replace(login_info);
    }

    fn likeds(&self) -> Option<HashSet<u64>> {
        self.likeds.clone()
    }
}
