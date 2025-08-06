use actix_web::{web, App, HttpServer, Responder, HttpRequest, HttpResponse};
use tokio::sync::{oneshot, Mutex};
use std::sync::Arc;
use std::net::SocketAddr;
use anyhow::Result;
use crate::setting::spotify::SpotifyData;
use chrono::{Utc, DateTime, Duration};
use reqwest::Client;
use tokio::time::{interval, Duration as TokioDuration};

#[derive(serde::Deserialize, Debug)] // 添加 Debug trait
struct CallbackParams {
    code: Option<String>,
    error: Option<String>,
}

// 添加TokenResponse结构体
#[derive(serde::Deserialize, Debug)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    scope: String,
    expires_in: i32,
    refresh_token: Option<String>, // 刷新令牌可能会也可能不会在响应中返回
}

/*
收到回调请求，参数: 
Query(
CallbackParams 
    { 
        code: Some("AQBaL1OEre9DJgo88r0s9b-Wx86JEGaTkaRIBqhYyl11TKDrx61xjn7Zu7e9XN0zMBkjUZiRv8PfJhILjJb1hk9wf_vFcurBZdU4zoBP9lFQgzCIP8NNFxykXQnVGxSoni7nbdf1lLIA6IcLdqnIYH-PDxG_qH4yJ5ctsrCQi1R31l6Sizj50-_3uuwfoyCsVnhyaRcInxHAIyrG3mn5D0W3mNx_e_P0WsrmzHW5elQuyu98wrleAFFhf7FjsYQBeleiERIO94c8Ez0ugVBmYM4oZfbNo487xT0G60qwAL3eG7qLtUvXWRIsRCDXoMDUrlSPWfJPv1u4uEtDAp9pqMDrRmkCxwqehiAZcyowpnt175qVkrAPbwwg_ypCuwgQk8S1UHH9d6TER9KHu7YmHr89Ib30plxw-OeaN63axyWdGoiwuSodAwG7xyP4txbn9jQA"), 
        error: None 
    }
)
*/
async fn handle_callback(
    _req: HttpRequest,
    params: web::Query<CallbackParams>,
    sender_data: web::Data<Arc<Mutex<Option<oneshot::Sender<String>>>>>,
) -> impl Responder {
    println!("收到回调请求，参数: {:?}", params);

    if let Some(code) = &params.code {
        // 读取现有的配置文件
        let mut spotify_data = match SpotifyData::load_from_file() {
            Ok(data) => data,
            Err(e) => {
                eprintln!("读取 Spotify 配置文件失败: {}", e);
                return HttpResponse::InternalServerError().body("无法读取配置文件");
            }
        };

        // 更新 code 并保存
        if let Err(e) = spotify_data.update(|data| {
            data.code = Some(code.clone());
            // 此处仅保存授权码，token和refresh_token将在交换授权码时获取
        }) {
            eprintln!("更新 Spotify 配置失败: {}", e);
            return HttpResponse::InternalServerError().body("无法更新配置文件");
        }

        if let Some(s) = sender_data.lock().await.take() {
            if s.send(code.clone()).is_err() {
                eprintln!("Spotify 回调: 无法发送授权码到 channel");
            }
            HttpResponse::Ok().body("授权成功！您可以关闭此页面。")
        } else {
            eprintln!("Spotify 授权回调错误: Sender 已经被使用或无效");
            HttpResponse::InternalServerError().body("服务器内部错误：无法处理授权回调")
        }
    } else if let Some(error) = &params.error {
        eprintln!("Spotify 授权错误: {}", error);
        HttpResponse::InternalServerError().body(format!("Spotify 授权错误: {}", error))
    } else {
        HttpResponse::BadRequest().body("无效的回调参数")
    }
}

pub struct ServerInfo {
    pub server_handle: actix_web::dev::ServerHandle,
    pub redirect_uri: String,
    pub code_rx: oneshot::Receiver<String>, // 用于接收授权码
    pub refresh_task_cancel: oneshot::Sender<()>, // 用于取消刷新令牌的定时任务
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

pub async fn start_server(mut spotify_data: SpotifyData) -> Result<ServerInfo> {
    // 检查令牌是否过期(超过1小时)
    if let (Some(token), Some(login_time)) = (&spotify_data.token, &spotify_data.login_time) {
        let now = Utc::now();
        let duration_since_login = now.signed_duration_since(*login_time);
        
        // 如果令牌已过期（超过1小时）
        if duration_since_login > Duration::hours(1) {
            println!("Spotify 令牌已过期，正在刷新...");
            
            match refresh_spotify_token(&spotify_data).await {
                Ok((new_token, maybe_new_refresh_token)) => {
                    // 更新访问令牌和登录时间
                    spotify_data.update(|data| {
                        data.token = Some(new_token);
                        // 如果有新的刷新令牌，也更新它
                        if let Some(new_refresh) = maybe_new_refresh_token {
                            data.refresh_token = Some(new_refresh);
                        }
                        data.login_time = Some(Utc::now());
                    })?;
                    
                    println!("Spotify 令牌刷新成功");
                },
                Err(e) => {
                    eprintln!("刷新 Spotify 令牌失败: {}", e);
                    // 继续使用现有令牌，不阻止服务器启动
                }
            }
        }
    }

    let uri = spotify_data.redirect_uri.clone();
    let addr_parts: Vec<&str> = uri.trim_start_matches("http://").split(':').collect();
    let ip = addr_parts[0];
    let port = addr_parts[1].parse::<u16>()?;
    
    let local_addr = SocketAddr::new(ip.parse().unwrap(), port);

    let (tx, rx) = oneshot::channel::<String>();
    let shared_sender = Arc::new(Mutex::new(Some(tx)));

    // 创建一个用于取消定时刷新任务的channel
    let (refresh_cancel_tx, mut refresh_cancel_rx) = oneshot::channel::<()>();
    
    // 创建一个共享的 SpotifyData 副本，用于定时刷新任务
    let spotify_data_clone = spotify_data.clone();
    
    // 启动一个后台任务，每55分钟刷新一次令牌
    tokio::spawn(async move {
        // 设置间隔为55分钟
        let mut interval = interval(TokioDuration::from_secs(55 * 60));
        
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    // 每55分钟执行一次
                    println!("执行定时任务：刷新 Spotify 令牌");
                    
                    // 读取最新的配置
                    match SpotifyData::load_from_file() {
                        Ok(mut current_data) => {
                            // 尝试刷新令牌
                            match refresh_spotify_token(&current_data).await {
                                Ok((new_token, maybe_new_refresh_token)) => {
                                    // 更新访问令牌和登录时间
                                    if let Err(e) = current_data.update(|data| {
                                        data.token = Some(new_token);
                                        // 如果有新的刷新令牌，也更新它
                                        if let Some(new_refresh) = maybe_new_refresh_token {
                                            data.refresh_token = Some(new_refresh);
                                        }
                                        data.login_time = Some(Utc::now());
                                    }) {
                                        eprintln!("更新 Spotify 数据失败: {}", e);
                                    } else {
                                        println!("定时任务：Spotify 令牌刷新成功");
                                    }
                                },
                                Err(e) => {
                                    eprintln!("定时任务：刷新 Spotify 令牌失败: {}", e);
                                }
                            }
                        },
                        Err(e) => {
                            eprintln!("定时任务：读取 Spotify 配置失败: {}", e);
                        }
                    }
                }
                _ = &mut refresh_cancel_rx => {
                    // 收到取消信号，退出循环
                    println!("Spotify 令牌刷新任务已取消");
                    break;
                }
            }
        }
    });

    let server = HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(Arc::clone(&shared_sender)))
            .route("/", web::get().to(handle_callback))
    })
    .bind(local_addr)?
    .run();

    let server_handle = server.handle();
    tokio::spawn(server);

    spotify_data.save_to_file()?;

    Ok(ServerInfo {
        server_handle,
        redirect_uri: uri,
        code_rx: rx,
        refresh_task_cancel: refresh_cancel_tx,
    })
} 