mod error;
pub mod impls;

use crate::application::Source;
use crate::client::Client;
use crate::types::play_list_info::PlayListInfo;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Module: Sync + Send {
    fn source(&mut self) -> Source;

    fn client(&mut self) -> &mut dyn Client;

    fn like_list(&mut self) -> Option<&mut PlayListInfo>;

    fn set_like_list(&mut self, like_list: PlayListInfo) -> Result<()>;
}
