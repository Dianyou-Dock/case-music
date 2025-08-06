use serde::{Deserialize, Serialize};
use crate::setting::spotify::SpotifyData;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::Rng;
use sha2::{Sha256, Digest};
use reqwest::Client;
use open;
use super::server;
use std::time::Duration;
use std::fs;
use dirs::home_dir;
use chrono::Utc;
use crate::setting::{CONFIG_DIR_PATH, SPOTIFY_FILE_PATH, USER_FILE_PATH};
use crate::SPOTIFY_SERVER_HANDLE;
use tokio::time::timeout;

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    pub token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    scope: String,
    expires_in: i32,
    refresh_token: String,
}

fn generate_code_verifier() -> String {
    let mut rng = rand::thread_rng();
    let verifier_bytes: Vec<u8> = (0..32).map(|_| rng.gen_range(0..255)).collect();
    URL_SAFE_NO_PAD.encode(verifier_bytes)
}

fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    URL_SAFE_NO_PAD.encode(result)
}

fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    let state_bytes: Vec<u8> = (0..16).map(|_| rng.gen_range(0..255)).collect();
    URL_SAFE_NO_PAD.encode(state_bytes)
}

#[tauri::command]
pub async fn spotify_login(request: LoginRequest) -> tauri::Result<LoginResponse> {
    println!("开始Spotify登录流程，用户: {}", request.username);
    
    // 先尝试停止任何可能正在运行的Spotify服务器
    {
        let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
        if let Some(handle) = handle_guard.take() {
            match timeout(Duration::from_secs(5), handle.stop(true)).await {
                Ok(_) => {
                    println!("登录前停止了之前的Spotify服务器");
                },
                Err(_) => {
                    println!("停止之前的Spotify服务器超时");
                    return Ok(LoginResponse {
                        success: false,
                        message: "无法停止之前的Spotify服务器，请重启应用后重试".to_string(),
                        token: None,
                    });
                }
            }
        }
    }

    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    let state = generate_state();

    let spotify_data = SpotifyData {
        code: None,
        username: request.username.clone(),
        token: None,
        refresh_token: None,
        client_id: request.client_id.clone(),
        client_secret: request.client_secret.clone(),
        redirect_uri: request.redirect_uri.clone(),
        login_time: None,
    };

    let server_info = match server::start_server(spotify_data).await {
        Ok(info) => info,
        Err(e) => {
            return Ok(LoginResponse {
                success: false,
                message: format!("启动回调服务器失败: {}", e),
                token: None,
            });
        }
    };

    let redirect_uri = server_info.redirect_uri;
    let server_handle = server_info.server_handle.clone(); // 克隆句柄以便稍后在错误处理中使用

    // 保存服务器句柄到全局变量
    {
        let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
        *handle_guard = Some(server_handle.clone()); // 再次克隆，以便不消耗所有权
    }

    let scopes = vec![
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-library-read",
        "user-library-modify",  // 添加修改收藏库的权限
        "user-top-read",
        "user-read-recently-played",
        "user-follow-read",
        "streaming",
        "user-modify-playback-state",
        "user-read-playback-state",
        "user-read-currently-playing"
    ].join("%20");

    let auth_url = format!(
        "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&code_challenge_method=S256&code_challenge={}&state={}&scope={}",
        request.client_id,
        redirect_uri,
        code_challenge,
        state,
        scopes
    );

    if let Err(e) = open::that(&auth_url) {
        // 停止服务器并从全局变量中移除
        let server_handle_clone = server_handle.clone(); // 克隆以避免所有权问题
        tokio::spawn(async move {
            server_handle_clone.stop(true).await;
        });
        
        // 清除全局句柄
        let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
        *handle_guard = None;
        
        return Ok(LoginResponse {
            success: false,
            message: format!("无法打开浏览器: {}", e),
            token: None,
        });
    }

    // 轮询配置文件获取 code
    let code = loop {
        match SpotifyData::load_from_file() {
            Ok(data) => {
                if let Some(code) = data.code {
                    break code;
                }
            }
            Err(e) => {
                // 停止服务器
                let server_handle_clone = server_handle.clone(); // 克隆以避免所有权问题
                tokio::spawn(async move {
                    server_handle_clone.stop(true).await;
                });
                
                // 清除全局句柄
                let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
                *handle_guard = None;
                
                return Ok(LoginResponse {
                    success: false,
                    message: format!("读取配置文件失败: {}", e),
                    token: None,
                });
            }
        }
        
        // 等待5秒
        tokio::time::sleep(Duration::from_secs(5)).await;
        
        // 检查是否超时
        if tokio::time::timeout(Duration::from_secs(300), tokio::time::sleep(Duration::from_secs(0))).await.is_err() {
            // 停止服务器
            let server_handle_clone = server_handle.clone(); // 克隆以避免所有权问题
            tokio::spawn(async move {
                server_handle_clone.stop(true).await;
            });
            
            // 清除全局句柄
            let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
            *handle_guard = None;
            
            return Ok(LoginResponse {
                success: false,
                message: "等待用户授权超时".to_string(),
                token: None,
            });
        }
    };
    


    let client = Client::new();
    let token_response = match client
        .post("https://accounts.spotify.com/api/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
            ("client_id", &request.client_id),
            ("code_verifier", &code_verifier),
        ])
        .send()
        .await
    {
        Ok(res) => res,
        Err(e) => {
            return Ok(LoginResponse {
                success: false,
                message: format!("请求令牌失败: {}", e),
                token: None,
            });
        }
    };

    let token_response = match token_response.json::<TokenResponse>().await {
        Ok(res) => res,
        Err(e) => {
            return Ok(LoginResponse {
                success: false,
                message: format!("解析令牌响应失败: {}", e),
                token: None,
            });
        }
    };

    let token = token_response.access_token.clone();
    let refresh_token = token_response.refresh_token.clone();
    println!("成功获取到Spotify访问令牌和刷新令牌");
    
    let spotify_data = SpotifyData {
        code: Some(code),
        username: request.username,
        token: Some(token.clone()),
        refresh_token: Some(refresh_token),
        client_id: request.client_id,
        client_secret: request.client_secret,
        redirect_uri: redirect_uri,
        login_time: Some(Utc::now()),
    };

    // 保存Spotify配置
    if let Err(e) = spotify_data.save_to_file() {
        println!("保存Spotify配置失败: {}", e);
        return Ok(LoginResponse {
            success: false,
            message: format!("保存配置失败: {}", e),
            token: None,
        });
    }
    println!("已保存Spotify配置文件");

    // 获取并保存用户信息
    match crate::spotify::user::fetch_and_save_user_info(&token).await {
        Ok(_) => Ok(LoginResponse {
            success: true,
            message: "登录成功，已获取用户信息".to_string(),
            token: Some(token),
        }),
        Err(e) => {
            // 即使获取用户信息失败，登录仍然算成功
            eprintln!("获取用户信息失败: {}", e);
            Ok(LoginResponse {
                success: true,
                message: "登录成功，但获取用户信息失败".to_string(),
                token: Some(token),
            })
        }
    }
}

#[tauri::command]
pub async fn check_spotify_login() -> tauri::Result<SpotifyData> {
    let spotify_data = SpotifyData::load_from_file()?;
    Ok(spotify_data)
}

#[tauri::command]
pub async fn spotify_logout() -> tauri::Result<LoginResponse> {
    println!("开始Spotify注销流程");
    
    // 尝试取消定时刷新任务
    let refresh_task_cancelled = {
        let mut refresh_cancel_guard = crate::SPOTIFY_REFRESH_CANCEL.lock().await;
        if let Some(cancel_sender) = refresh_cancel_guard.take() {
            // 发送取消信号
            match cancel_sender.send(()) {
                Ok(_) => {
                    println!("Spotify 刷新任务已取消");
                    true
                },
                Err(_) => {
                    println!("取消 Spotify 刷新任务失败");
                    false
                }
            }
        } else {
            println!("没有运行中的 Spotify 刷新任务");
            true
        }
    };

    // 尝试停止Spotify服务器
    let server_stopped = {
        let mut handle_guard = SPOTIFY_SERVER_HANDLE.lock().await;
        if let Some(handle) = handle_guard.take() {
            match timeout(Duration::from_secs(5), handle.stop(true)).await {
                Ok(_) => {
                    println!("Spotify 服务器已停止");
                    true
                },
                Err(_) => {
                    println!("停止 Spotify 服务器超时");
                    false
                }
            }
        } else {
            println!("没有运行中的 Spotify 服务器");
            true
        }
    };

    // 获取家目录
    let home = match home_dir() {
        Some(path) => path,
        None => {
            return Ok(LoginResponse {
                success: false,
                message: "无法获取家目录".to_string(),
                token: None,
            });
        }
    };
    
    // 构建 .case 目录路径
    let config_dir = home.join(CONFIG_DIR_PATH);
    
    // 构建Spotify配置文件路径
    let spotify_file_path = config_dir.join(SPOTIFY_FILE_PATH);
    
    // 构建用户数据文件路径
    let user_file_path = config_dir.join(USER_FILE_PATH);
    
    // 删除Spotify配置文件
    if let Err(e) = fs::remove_file(&spotify_file_path) {
        println!("删除 Spotify 配置文件失败: {}", e);
        // 继续执行，因为这不是关键错误
    } else {
        println!("已成功删除 Spotify 配置文件");
    }
    
    // 尝试删除用户数据文件（如果存在）
    let user_file_result = if user_file_path.exists() {
        fs::remove_file(&user_file_path)
    } else {
        Ok(())
    };
    
    // 检查结果
    if user_file_result.is_err() {
        let mut error_msg = String::new();
        if let Err(e) = user_file_result {
            error_msg.push_str(&format!("删除用户数据失败: {}", e));
        }
        
        return Ok(LoginResponse {
            success: false,
            message: error_msg,
            token: None,
        });
    }
    
    // 成功删除文件
    Ok(LoginResponse {
        success: true,
        message: if server_stopped && refresh_task_cancelled {
            "登出成功，Spotify 服务器和刷新任务已停止".to_string()
        } else if server_stopped {
            "登出成功，Spotify 服务器已停止，但无法停止刷新任务".to_string()
        } else if refresh_task_cancelled {
            "登出成功，刷新任务已停止，但无法停止 Spotify 服务器".to_string()
        } else {
            "登出成功，但无法停止 Spotify 服务器和刷新任务".to_string()
        },
        token: None,
    })
}

#[tauri::command]
pub async fn force_spotify_relogin() -> tauri::Result<LoginResponse> {
    // 执行登出操作
    if let Err(e) = spotify_logout().await {
        return Err(e);
    }
    
    // 提示用户需要重新登录
    Ok(LoginResponse {
        success: true,
        message: "已清除登录信息，请重新登录Spotify以更新令牌".to_string(),
        token: None,
    })
}
