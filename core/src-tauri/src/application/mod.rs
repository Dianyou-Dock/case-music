use crate::client::Client;

pub mod ai;

pub mod music;

pub mod system;

pub struct Application {
    client: Box<dyn Client + Sync + Send>,
}

impl Application {
    pub fn new(client: Box<dyn Client>) -> Application {
        Application { client }
    }
}
