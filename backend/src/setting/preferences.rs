use crate::setting::{CONFIG_DIR_PATH, PREFERENCES_FILE_PATH, USER_FILE_PATH};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserData {
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preferences {
    pub user_data: UserData,
}

impl Preferences {
    pub fn load_or_create() -> Result<Self> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "无法找到用户主目录"))?;

        let mut config_dir_path = home_dir; // home_dir from dirs::home_dir() is Option<PathBuf>
        config_dir_path.push(CONFIG_DIR_PATH);

        fs::create_dir_all(&config_dir_path)?;

        let file_path = config_dir_path.join(PREFERENCES_FILE_PATH);

        if !file_path.exists() {
            let default_user_data = UserData {
                file_path: config_dir_path
                    .join(USER_FILE_PATH)
                    .to_string_lossy()
                    .to_string(),
            };
            let default_prefs = Preferences {
                user_data: default_user_data,
            };

            let toml_string = toml::to_string_pretty(&default_prefs)?;
            fs::write(&file_path, toml_string)?;
        }

        let content = fs::read_to_string(&file_path)?;
        let preferences: Preferences = toml::from_str(&content)?;

        Ok(preferences)
    }
}
