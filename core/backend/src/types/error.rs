use anyhow::{anyhow, Error, Result};
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

    #[strum(serialize = "like list not exist")]
    LikeListNotExist,
}

impl MusicClientError {
    pub fn code(&self) -> i32 {
        match self {
            MusicClientError::QrTimeout => -100,
            MusicClientError::QrWaitScan => -200,
            MusicClientError::QrWaitConfirm => -300,
            MusicClientError::QrUnknown => -400,
            MusicClientError::CookieIsNull => -500,
            MusicClientError::LoginFail => -600,
            MusicClientError::UserSongListIsNull => -700,
            MusicClientError::LikeListNotExist => -800,
        }
    }

    pub fn from_code(code: i32) -> Result<Self> {
        match code {
            -100 => Ok(MusicClientError::QrTimeout),
            -200 => Ok(MusicClientError::QrWaitScan),
            -300 => Ok(MusicClientError::QrWaitConfirm),
            -400 => Ok(MusicClientError::QrUnknown),
            -500 => Ok(MusicClientError::CookieIsNull),
            -600 => Ok(MusicClientError::LoginFail),
            -700 => Ok(MusicClientError::UserSongListIsNull),
            -800 => Ok(MusicClientError::LikeListNotExist),
            _ => Err(anyhow!("not match code: {code}")),
        }
    }
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

////////////////////////////////////////////////////////////////////////////////////////////////////

#[derive(Debug, EnumString, Display)]
pub enum AiError {
    #[strum(serialize = "Kimi's return has no content")]
    KimiRespNotExistContent,
}

impl ErrorHandle for AiError {
    fn anyhow_err(&self) -> Error {
        anyhow!("{}", self.to_string())
    }
}
