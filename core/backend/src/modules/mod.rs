pub mod impls;

use crate::music_client::Client;
use crate::types::constants::MusicSource;
use crate::types::login_info::LoginInfo;
use crate::types::play_list_info::PlayListInfo;
use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashSet;

#[async_trait]
pub trait MusicModule: Sync + Send {
    fn source(&mut self) -> MusicSource;

    fn client(&mut self) -> &mut dyn Client;

    fn like_list(&mut self) -> Option<&mut PlayListInfo>;

    fn set_like_list(&mut self, like_list: PlayListInfo) -> Result<()>;

    fn login_info(&self) -> Option<LoginInfo>;

    fn set_login_info(&mut self, login_info: LoginInfo);

    fn likeds(&self) -> Option<HashSet<u64>>;
}
