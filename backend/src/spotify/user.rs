use serde::{Deserialize, Serialize};
use reqwest::Client;
use crate::setting::spotify::SpotifyData;
use crate::setting::USER_FILE_PATH;
use anyhow::Result;
use std::fs;
use dirs::home_dir;
use crate::setting::CONFIG_DIR_PATH;
use crate::spotify::token;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub country: Option<String>,
    pub images: Vec<UserImage>,
    pub followers: UserFollowers,
    pub external_urls: ExternalUrls,
    pub product: Option<String>,
    pub explicit_content: Option<ExplicitContent>,
    #[serde(rename = "type")]
    pub user_type: String,
    pub uri: String,
    pub href: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserImage {
    pub url: String,
    pub height: Option<i32>,
    pub width: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFollowers {
    pub href: Option<String>,
    pub total: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalUrls {
    pub spotify: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplicitContent {
    pub filter_enabled: bool,
    pub filter_locked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetUserProfileResponse {
    pub success: bool,
    pub message: String,
    pub profile: Option<UserProfile>,
}

// 用户数据结构体，用于保存到文件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserData {
    pub profile: UserProfile,
}

impl UserData {
    pub fn new(profile: UserProfile) -> Self {
        Self { profile }
    }

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
        let file_path = config_dir.join(USER_FILE_PATH);
        
        // 将数据序列化为 TOML 字符串
        let toml_string = toml::to_string_pretty(self)?;
        
        // 写入文件
        fs::write(file_path, toml_string)?;
        
        Ok(())
    }

    pub fn load_from_file() -> Result<Self> {
        let home = home_dir().ok_or_else(|| anyhow::anyhow!("无法获取家目录"))?;
        let config_dir = home.join(CONFIG_DIR_PATH);
        let file_path = config_dir.join(USER_FILE_PATH);

        if !file_path.exists() {
            return Err(anyhow::anyhow!("用户数据文件不存在: {}", file_path.display()));
        }

        let toml_string = fs::read_to_string(file_path)?;
        let user_data: Self = toml::from_str(&toml_string)?;
        Ok(user_data)
    }
}

async fn fetch_current_user_profile(token: &str) -> Result<UserProfile> {
    let client = Client::new();
    let response = client
        .get("https://api.spotify.com/v1/me")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Spotify API错误: {} - {}", status, error_text));
    }

    let profile = response.json::<UserProfile>().await?;
    Ok(profile)
}

#[tauri::command]
pub async fn get_current_user_profile() -> tauri::Result<GetUserProfileResponse> {
    // 尝试从文件加载用户数据
    if let Ok(user_data) = UserData::load_from_file() {
        return Ok(GetUserProfileResponse {
            success: true,
            message: "成功从文件获取用户个人资料".to_string(),
            profile: Some(user_data.profile),
        });
    }

    // 如果文件不存在，则从API获取
    // 获取有效的访问令牌
    let token = match token::get_valid_token().await {
        Ok(token) => token,
        Err(e) => {
            return Ok(GetUserProfileResponse {
                success: false,
                message: format!("获取有效的Spotify令牌失败: {}", e),
                profile: None,
            });
        }
    };

    // 获取当前用户个人资料
    match fetch_current_user_profile(&token).await {
        Ok(profile) => {
            // 创建并保存用户数据
            let user_data = UserData::new(profile.clone());
            if let Err(e) = user_data.save_to_file() {
                eprintln!("保存用户数据失败: {}", e);
            }
            
            Ok(GetUserProfileResponse {
                success: true,
                message: "成功获取用户个人资料".to_string(),
                profile: Some(profile),
            })
        },
        Err(e) => Ok(GetUserProfileResponse {
            success: false,
            message: format!("获取用户个人资料失败: {}", e),
            profile: None,
        }),
    }
}

// 获取并保存用户信息
pub async fn fetch_and_save_user_info(token: &str) -> Result<UserProfile> {
    let profile = fetch_current_user_profile(token).await?;
    let user_data = UserData::new(profile.clone());
    user_data.save_to_file()?;
    Ok(profile)
} 