use crate::ai_client::Client as AiClient;
use crate::modules::impls::netesae::NetesaeModule;
use crate::modules::MusicModule;
use serde::{Deserialize, Serialize};

pub mod ai;

pub mod music;

mod resp;
pub mod system;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum MusicSource {
    Netesae,
    Spotify,
    QQ,
    Apple,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AiSource {
    Kimi,
}

pub struct Application {
    pub netesae: Box<dyn MusicModule>,
    pub ai: Option<Box<dyn AiClient>>,
}

impl Application {
    pub fn new(netesae: NetesaeModule) -> Application {
        Application {
            netesae: Box::new(netesae),
            ai: None,
        }
    }
}
