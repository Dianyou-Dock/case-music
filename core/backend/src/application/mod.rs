use crate::modules::impls::netesae::NetesaeModule;
use crate::modules::Module;
use serde::{Deserialize, Serialize};

pub mod ai;

pub mod music;

mod resp;
pub mod system;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Source {
    Netesae,
    Spotify,
    QQ,
    Apple,
}

pub struct Application {
    pub netesae: Box<dyn Module>,
}

impl Application {
    pub fn new(netesae: NetesaeModule) -> Application {
        Application {
            netesae: Box::new(netesae),
        }
    }
}
