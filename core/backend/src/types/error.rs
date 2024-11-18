use anyhow::{anyhow, Error};
use strum_macros::{Display, EnumString};

pub trait ErrorHandle {
    fn anyhow_err(&self) -> anyhow::Error;
}
////////////////////////////////////////////////////////////////////////////////////////////////////

#[derive(Debug, EnumString, Display)]
pub enum MusicClientError {
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

impl ErrorHandle for MusicClientError {
    fn anyhow_err(&self) -> Error {
        anyhow!("{}", self.to_string())
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////

#[derive(Debug, EnumString, Display)]
pub enum ApplicationError {
    #[strum(serialize = "ai not use, please set api key")]
    AiNotUse,
}

impl ErrorHandle for ApplicationError {
    fn anyhow_err(&self) -> Error {
        anyhow!("{}", self.to_string())
    }
}
