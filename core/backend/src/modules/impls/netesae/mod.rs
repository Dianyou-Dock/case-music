use crate::application::MusicSource;
use crate::modules::MusicModule;
use crate::music_client::impls::netesae::NeteaseClient;
use crate::music_client::Client;
use crate::types::play_list_info::PlayListInfo;
use anyhow::Result;
use async_trait::async_trait;

pub struct NetesaeModule {
    client: Box<dyn Client>,
    like_list: Option<PlayListInfo>,
}

impl NetesaeModule {
    pub fn new() -> Result<Self> {
        let netesae_client = NeteaseClient::new()?;
        Ok(Self {
            client: Box::new(netesae_client),
            like_list: None,
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
        self.like_list = Some(like_list);
        Ok(())
    }
}
