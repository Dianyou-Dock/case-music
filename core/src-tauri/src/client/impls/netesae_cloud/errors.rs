use anyhow::anyhow;
use strum_macros::{EnumString, ToString};

#[derive(Debug, EnumString, ToString)]
pub enum NetesaeError {
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
}

impl NetesaeError {
    pub fn anyhow_err(&self) -> anyhow::Error {
        anyhow!("{}", self.to_string())
    }
}
