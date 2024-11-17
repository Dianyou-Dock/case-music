use anyhow::anyhow;
use strum_macros::{Display, EnumString};

#[derive(Debug, EnumString, Display)]
pub enum ClientError {
    #[strum(serialize = "qr code timeout")]
    QrTimeout,
    #[strum(serialize = "qr code not scan")]
    QrWaitScan,
    #[strum(serialize = "qr code waiting for confirm")]
    QrWaitConfirm,
    #[strum(serialize = "Login by qr, code unknown")]
    QrUnknown,

    #[strum(serialize = "cookie is null")]
    CookieIsNull,
    #[strum(serialize = "login status not success")]
    LoginFail,

    #[strum(serialize = "user song list is null")]
    UserSongListIsNull,
}

impl ClientError {
    pub fn anyhow_err(&self) -> anyhow::Error {
        anyhow!("{}", self.to_string())
    }
}
