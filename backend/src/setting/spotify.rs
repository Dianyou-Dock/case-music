use std::fs;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use dirs::home_dir;
use chrono::{DateTime, Utc};
use crate::setting::{CONFIG_DIR_PATH, SPOTIFY_FILE_PATH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyData {
    pub code: Option<String>,
    pub username: String,
    pub token: Option<String>,
    pub refresh_token: Option<String>,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub login_time: Option<DateTime<Utc>>,
}

impl SpotifyData {
    pub fn save_to_file(&self) -> Result<()> {
        // 获取家目录
        let home = home_dir().ok_or_else(|| anyhow::anyhow!("无法获取家目录"))?;
        
        // 构建 .case 目录路径
        let config_dir = home.join(CONFIG_DIR_PATH);
        
        // 如果目录不存在则创建
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)?;
        }
        
        // 构建完整的文件路径
        let file_path = config_dir.join(SPOTIFY_FILE_PATH);
        
        // 将数据序列化为 TOML 字符串
        let toml_string = toml::to_string_pretty(self)?;
        
        // 写入文件
        fs::write(file_path, toml_string)?;
        
        Ok(())
    }

    pub fn load_from_file() -> Result<Self> {
        let home = home_dir().ok_or_else(|| anyhow::anyhow!("无法获取家目录"))?;
        let config_dir = home.join(CONFIG_DIR_PATH);
        let file_path = config_dir.join(SPOTIFY_FILE_PATH);

        if !file_path.exists() {
            return Err(anyhow::anyhow!("Spotify 配置文件不存在: {}", file_path.display()));
        }

        let toml_string = fs::read_to_string(file_path)?;
        let spotify_data: Self = toml::from_str(&toml_string)?;
        Ok(spotify_data)
    }

    pub fn update<F>(&mut self, f: F) -> Result<()>
    where
        F: FnOnce(&mut Self)
    {
        f(self);
        self.save_to_file()
    }

    pub fn is_valid(&self) -> bool {
        // 检查必要的字段是否都存在且不为空
        !self.username.is_empty() 
            && !self.client_id.is_empty() 
            && !self.client_secret.is_empty() 
            && !self.redirect_uri.is_empty()
            && self.token.is_some()
        // login_time 和 refresh_token 是可选的，不影响有效性检查
    }
}

