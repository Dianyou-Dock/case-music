pub mod error;
pub mod impls;

use crate::types::login_info::{LoginInfo, LoginQrInfo};
use crate::types::play_list_info::PlayListInfo;
use crate::types::song_info::SongInfo;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Client: Sync + Send {
    async fn login_qr(&mut self) -> Result<LoginQrInfo>;

    async fn login_by_unikey(&mut self, unikey: String) -> Result<LoginInfo>;

    async fn logout(&mut self) -> Result<()>;

    async fn like_list(&mut self, user_id: u64) -> Result<PlayListInfo>;

    async fn song_infos(&mut self, song_id_list: &[u64]) -> Result<Vec<SongInfo>>;
}
