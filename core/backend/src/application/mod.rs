use crate::ai_client::impls::kimi::Kimi;
use crate::ai_client::Client as AiClient;
use crate::modules::impls::netesae::NetesaeModule;
use crate::modules::MusicModule;
use crate::types::constants::DATA_PATH;
use std::path::PathBuf;

pub mod ai;

pub mod music;

mod resp;
pub mod system;

pub struct Application {
    pub netesae: Box<dyn MusicModule>,
    pub ai: Option<Box<dyn AiClient>>,
    pub data_path: PathBuf,
}

impl Application {
    pub fn new(netesae: NetesaeModule) -> Application {
        let mut app = Application {
            netesae: Box::new(netesae),
            ai: None,
            data_path: DATA_PATH.clone(),
        };

        // TODO:
        // Kimi is used temporarily here.
        // It will become variable after adding new configuration files.
        // Of course, Kimi is still the default.
        let kimi = Kimi::load().unwrap();
        kimi.map(|v| app.ai.replace(Box::new(v)));

        app
    }
}
