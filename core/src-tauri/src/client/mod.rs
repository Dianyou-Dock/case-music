pub mod impls;
pub mod resp;

use crate::client::resp::GetLoginQrResp;
use anyhow::Result;
use async_trait::async_trait;
use ncm_api::LoginInfo;

#[async_trait]
pub trait Client: Sync + Send {
    async fn get_login_qr(&mut self) -> Result<GetLoginQrResp>;

    async fn login_by_unikey(&mut self, unikey: String) -> Result<LoginInfo>;

    async fn logout(&mut self) -> Result<()>;
}
