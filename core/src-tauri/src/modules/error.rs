use anyhow::anyhow;
use strum_macros::{Display, EnumString};

#[derive(Debug, EnumString, Display)]
pub enum ModuleError {
    #[strum(serialize = "like list is null")]
    LikeListIsNull,
}

impl ModuleError {
    pub fn anyhow_err(&self) -> anyhow::Error {
        anyhow!("{}", self.to_string())
    }
}
