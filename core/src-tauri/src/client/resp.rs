use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GetLoginQrResp {
    pub url: String,
    pub unikey: String,
}
