use reqwest::Client;
use anyhow::Result;
use chrono::{Utc, Duration};
use crate::setting::spotify::SpotifyData;

// 添加TokenResponse结构体
#[derive(serde::Deserialize, Debug)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    scope: String,
    expires_in: i32,
    refresh_token: Option<String>, // 刷新令牌可能会也可能不会在响应中返回
}

// 使用授权码获取访问令牌和刷新令牌
pub async fn exchange_code_for_token(mut spotify_data: SpotifyData) -> Result<SpotifyData> {
    // 确保有授权码
    let code = match &spotify_data.code {
        Some(code) => code.clone(),
        None => return Err(anyhow::anyhow!("没有授权码可用")),
    };

    let client = Client::new();
    
    // 创建Basic认证头
    let auth_header = format!(
        "Basic {}", 
        base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD, 
            format!("{}:{}", spotify_data.client_id, spotify_data.client_secret)
        )
    );
    
    // 发送请求交换授权码
    let response = client
        .post("https://accounts.spotify.com/api/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Authorization", auth_header)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &spotify_data.redirect_uri),
        ])
        .send()
        .await?;
        
    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "授权码交换请求失败: {} - {}", 
            response.status(),
            response.text().await?
        ));
    }
    
    // 解析响应
    let token_response = response.json::<TokenResponse>().await?;
    
    // 更新Spotify数据
    spotify_data.update(|data| {
        data.token = Some(token_response.access_token);
        data.refresh_token = token_response.refresh_token;
        data.login_time = Some(Utc::now());
    })?;
    
    Ok(spotify_data)
}

// 刷新令牌的函数
async fn refresh_spotify_token(spotify_data: &SpotifyData) -> Result<(String, Option<String>)> {
    let client = Client::new();
    
    // 获取刷新令牌
    let refresh_token = match &spotify_data.refresh_token {
        Some(token) => token,
        None => return Err(anyhow::anyhow!("没有刷新令牌可用")),
    };
    
    let auth_header = format!(
        "Basic {}", 
        base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD, 
            format!("{}:{}", spotify_data.client_id, spotify_data.client_secret)
        )
    );
    
    let response = client
        .post("https://accounts.spotify.com/api/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Authorization", auth_header)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ])
        .send()
        .await?;
        
    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "刷新令牌请求失败: {} - {}", 
            response.status(),
            response.text().await?
        ));
    }
    
    let token_response = response.json::<TokenResponse>().await?;
    
    // 返回新的访问令牌和可能存在的新刷新令牌
    Ok((token_response.access_token, token_response.refresh_token))
}

// 导出get_valid_token函数，供前端调用
#[tauri::command]
pub async fn get_valid_token() -> tauri::Result<String> {
    match get_valid_token_internal().await {
        Ok(token) => Ok(token),
        Err(e) => Err(tauri::Error::from(anyhow::anyhow!("获取有效的Spotify令牌失败: {}", e)))
    }
}

// 获取有效的访问令牌
pub async fn get_valid_token_internal() -> anyhow::Result<String> {
    // 加载Spotify配置
    let mut spotify_data = SpotifyData::load_from_file()?;
    
    // 检查令牌是否存在
    if spotify_data.token.is_none() {
        return Err(anyhow::anyhow!("没有访问令牌可用"));
    }
    
    // 检查令牌是否过期(超过50分钟)
    if let Some(login_time) = spotify_data.login_time {
        let now = Utc::now();
        let duration_since_login = now.signed_duration_since(login_time);
        
        // 如果令牌已过期（超过50分钟）
        if duration_since_login > Duration::minutes(50) {
            println!("Spotify 令牌已过期，正在刷新...");
            
            if spotify_data.refresh_token.is_none() {
                println!("错误: 没有刷新令牌可用! 需要重新登录");
                return Err(anyhow::anyhow!("没有刷新令牌可用，请重新登录"));
            }
            
            match refresh_spotify_token(&spotify_data).await {
                Ok((new_token, maybe_new_refresh_token)) => {
                    // 更新访问令牌和登录时间
                    spotify_data.update(|data| {
                        data.token = Some(new_token.clone());
                        // 如果有新的刷新令牌，也更新它
                        if let Some(new_refresh) = maybe_new_refresh_token {
                            data.refresh_token = Some(new_refresh);
                            println!("已更新刷新令牌");
                        }
                        data.login_time = Some(Utc::now());
                    })?;
                    
                    println!("Spotify 令牌刷新成功");
                    return Ok(new_token);
                },
                Err(e) => {
                    eprintln!("刷新 Spotify 令牌失败: {}", e);
                    return Err(anyhow::anyhow!("刷新令牌失败: {}", e));
                }
            }
        } else {
        }
    } else {
        println!("警告: 令牌没有登录时间信息");
    }
    
    // 令牌有效，直接返回
    Ok(spotify_data.token.unwrap())
}

// 获取令牌信息的命令
#[tauri::command]
pub async fn get_token_info() -> tauri::Result<TokenInfo> {
    match get_token_info_internal().await {
        Ok(info) => Ok(info),
        Err(e) => Err(tauri::Error::from(anyhow::anyhow!("获取令牌信息失败: {}", e)))
    }
}

// 获取令牌信息
pub async fn get_token_info_internal() -> anyhow::Result<TokenInfo> {
    // 加载Spotify配置
    let spotify_data = SpotifyData::load_from_file()?;
    
    // 检查是否有令牌
    if spotify_data.token.is_none() {
        return Err(anyhow::anyhow!("没有访问令牌"));
    }
    
    // 获取当前时间
    let now = chrono::Utc::now();
    
    // 检查令牌是否过期（如果login_time存在且早于1小时前，则认为过期）
    let is_expired = match spotify_data.login_time {
        Some(login_time) => {
            // 计算token有效期（1小时）
            let expiry_time = login_time + chrono::Duration::hours(1);
            now > expiry_time
        },
        None => true // 如果没有登录时间，视为过期
    };
    
    // 计算剩余有效期（秒）
    let expires_in = match spotify_data.login_time {
        Some(login_time) if !is_expired => {
            let expiry_time = login_time + chrono::Duration::hours(1);
            let remaining = expiry_time.signed_duration_since(now);
            remaining.num_seconds()
        },
        _ => 0
    };
    
    Ok(TokenInfo {
        has_token: spotify_data.token.is_some(),
        is_expired,
        expires_in,
        token: spotify_data.token.unwrap_or_default(),
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct TokenInfo {
    pub has_token: bool,
    pub is_expired: bool,
    pub expires_in: i64,
    pub token: String,
}
