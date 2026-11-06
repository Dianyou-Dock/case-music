use crate::application::resp::ApplicationResp;
use crate::types::constants::data_path;
use anyhow::{anyhow, Context, Result};
use netease_qq_music_api::client::LoginSession;
use netease_qq_music_api::models::{LoginStatus, LoginToken, Platform, PlaylistDetailResult, SearchPlaylistResult, SearchSongResult, SongQuality, TencentLoginToken, TencentUserPlaylists};
use netease_qq_music_api::MusicClient;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::sync::Mutex;
use tauri::ipc::InvokeError;

static CLIENT: Lazy<MusicClient> = Lazy::new(MusicClient::new);
static SESSION: Lazy<Mutex<Option<LoginSession<'static>>>> = Lazy::new(|| Mutex::new(None));
const TOKEN_FILE: &str = "qqmusic-token.json";

fn token_path() -> std::path::PathBuf { data_path().join(TOKEN_FILE) }

fn saved_token() -> Result<Option<TencentLoginToken>> {
    let path = token_path();
    if !path.exists() { return Ok(None); }
    Ok(Some(serde_json::from_slice(&std::fs::read(path)?)?))
}

fn save_token(token: &TencentLoginToken) -> Result<()> {
    let path = token_path();
    let data = serde_json::to_vec(token)?;
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path)?;
        file.write_all(&data)?;
    }
    #[cfg(not(unix))]
    std::fs::write(path, data)?;
    Ok(())
}

async fn active_token() -> Result<Option<TencentLoginToken>> {
    let Some(token) = saved_token()? else { return Ok(None); };
    let should_refresh = token.expires_at().is_some_and(|expires| expires <= time::OffsetDateTime::now_utc().unix_timestamp() + 300);
    if !should_refresh { return Ok(Some(token)); }
    match CLIENT.login().refresh().platform(Platform::Tencent).token(&token).send().await? {
        LoginToken::Tencent(refreshed) => { save_token(&refreshed)?; Ok(Some(refreshed)) }
        _ => Err(anyhow!("Unexpected QQ refresh token")),
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct QqStatus { pub connected: bool }

#[tauri::command]
pub async fn qq_status() -> Result<ApplicationResp<QqStatus>, InvokeError> {
    Ok(ApplicationResp::success_data(QqStatus { connected: saved_token().map_err(InvokeError::from_anyhow)?.is_some() }))
}

#[tauri::command]
pub async fn qq_login_start() -> Result<ApplicationResp<String>, InvokeError> {
    let session = CLIENT.login().session().platform(Platform::Tencent).send().await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    let qr = session.qr_code().to_string();
    *SESSION.lock().map_err(|_| InvokeError::from_anyhow(anyhow!("QQ login lock failed")))? = Some(session);
    Ok(ApplicationResp::success_data(qr))
}

#[tauri::command]
pub async fn qq_login_poll() -> Result<ApplicationResp<String>, InvokeError> {
    let session = SESSION.lock().map_err(|_| InvokeError::from_anyhow(anyhow!("QQ login lock failed")))?.take().context("Start QQ login first").map_err(InvokeError::from_anyhow)?;
    let result = session.status().await;
    let state = match result {
        Ok(LoginStatus::WaitingScan) => "waiting_scan",
        Ok(LoginStatus::WaitingConfirm) => "waiting_confirm",
        Ok(LoginStatus::QrCodeExpired) => "expired",
        Ok(LoginStatus::Success(LoginToken::Tencent(token))) => {
            save_token(&token).map_err(InvokeError::from_anyhow)?;
            "connected"
        }
        Ok(LoginStatus::Success(_)) => return Err(InvokeError::from_anyhow(anyhow!("Unexpected QQ login token"))),
        Err(error) => return Err(InvokeError::from_anyhow(error.into())),
    };
    if state != "connected" && state != "expired" {
        *SESSION.lock().map_err(|_| InvokeError::from_anyhow(anyhow!("QQ login lock failed")))? = Some(session);
    }
    Ok(ApplicationResp::success_data(state.to_string()))
}

#[tauri::command]
pub async fn qq_disconnect() -> Result<ApplicationResp<()>, InvokeError> {
    *SESSION.lock().map_err(|_| InvokeError::from_anyhow(anyhow!("QQ login lock failed")))? = None;
    let path = token_path();
    if path.exists() { std::fs::remove_file(path).map_err(|error| InvokeError::from_anyhow(error.into()))?; }
    Ok(ApplicationResp::success_data(()))
}

#[tauri::command]
pub async fn qq_search(keyword: String, offset: u64) -> Result<ApplicationResp<SearchSongResult>, InvokeError> {
    let keyword = keyword.trim();
    if keyword.is_empty() { return Err(InvokeError::from_anyhow(anyhow!("Search keyword is required"))); }
    let token = active_token().await.map_err(InvokeError::from_anyhow)?;
    let request = CLIENT.search().song().platform(Platform::Tencent).keyword(keyword).offset(offset).limit(30);
    let result = if let Some(ref token) = token { request.login(token).send().await } else { request.send().await };
    Ok(ApplicationResp::success_data(result.map_err(|error| InvokeError::from_anyhow(error.into()))?))
}

#[tauri::command]
pub async fn qq_playback_url(id: String) -> Result<ApplicationResp<String>, InvokeError> {
    if id.is_empty() || id.len() > 128 { return Err(InvokeError::from_anyhow(anyhow!("Invalid song ID"))); }
    let token = active_token().await.map_err(InvokeError::from_anyhow)?;
    let request = CLIENT.playback().url().platform(Platform::Tencent).id(id).level(SongQuality::Standard);
    let result = if let Some(ref token) = token { request.login(token).send().await } else { request.send().await };
    let result = result.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if result.url.is_empty() { return Err(InvokeError::from_anyhow(anyhow!("No playable URL for this song or account"))); }
    Ok(ApplicationResp::success_data(result.url))
}

#[tauri::command]
pub async fn qq_search_playlists(keyword: String) -> Result<ApplicationResp<SearchPlaylistResult>, InvokeError> {
    let token = active_token().await.map_err(InvokeError::from_anyhow)?;
    let request = CLIENT.search().playlist().platform(Platform::Tencent).keyword(keyword.trim()).limit(20);
    let result = if let Some(ref token) = token { request.login(token).send().await } else { request.send().await };
    Ok(ApplicationResp::success_data(result.map_err(|error| InvokeError::from_anyhow(error.into()))?))
}

#[tauri::command]
pub async fn qq_playlist(id: String) -> Result<ApplicationResp<PlaylistDetailResult>, InvokeError> {
    let token = active_token().await.map_err(InvokeError::from_anyhow)?;
    let request = CLIENT.playlist().detail().platform(Platform::Tencent).id(id);
    let result = if let Some(ref token) = token { request.login(token).send().await } else { request.send().await };
    Ok(ApplicationResp::success_data(result.map_err(|error| InvokeError::from_anyhow(error.into()))?))
}

#[tauri::command]
pub async fn qq_user_playlists() -> Result<ApplicationResp<TencentUserPlaylists>, InvokeError> {
    let token = active_token().await.map_err(InvokeError::from_anyhow)?.context("请先登录 QQ 音乐").map_err(InvokeError::from_anyhow)?;
    let result = CLIENT.tencent_user_playlists(&token).await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    Ok(ApplicationResp::success_data(result))
}

#[tauri::command]
pub async fn qq_user_playlist(id: String) -> Result<ApplicationResp<PlaylistDetailResult>, InvokeError> {
    let token = active_token().await.map_err(InvokeError::from_anyhow)?.context("请先登录 QQ 音乐").map_err(InvokeError::from_anyhow)?;
    let result = CLIENT.tencent_user_playlist(&id, &token).await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    Ok(ApplicationResp::success_data(result))
}
