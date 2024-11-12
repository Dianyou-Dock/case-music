use crate::client::Client;
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
    client: Box<dyn Client + Sync + Send>,
    like_list: Vec<u64>,
}

impl Application {
    pub fn new(client: Box<dyn Client>) -> Application {
        Application {
            client,
            like_list: vec![],
        }
    }
}
