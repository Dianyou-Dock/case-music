pub mod impls;
pub mod types;

use crate::client::types::login_info::{ClientLoginInfo, LoginQrInfo};
use crate::client::types::song_info::ClientSongInfo;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Client: Sync + Send {
    async fn login_qr(&mut self) -> Result<LoginQrInfo>;

    async fn login_by_unikey(&mut self, unikey: String) -> Result<ClientLoginInfo>;

    async fn logout(&mut self) -> Result<()>;

    async fn like_list(&mut self, user_id: u64) -> Result<Vec<u64>>;

    async fn song_infos(&mut self, song_id_list: &[u64]) -> Result<Vec<ClientSongInfo>>;
}
