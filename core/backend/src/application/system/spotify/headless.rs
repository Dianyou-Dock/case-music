use super::access_token;
use crate::application::resp::ApplicationResp;
use anyhow::{bail, Context, Result};
use rand::{rngs::OsRng, RngCore};
use serde::Serialize;
use serde_json::{json, Value};
use std::{collections::VecDeque, process::Stdio, sync::Arc, time::Duration};
use std::os::unix::process::CommandExt;
use tauri::ipc::InvokeError;
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::{TcpListener, TcpStream}, process::{Child, Command}, sync::{Mutex, Notify}};

#[derive(Clone, Debug, Default, Serialize)]
pub struct HeadlessStatus {
    pub ready: bool,
    pub device_id: Option<String>,
    pub error: String,
    pub track: Option<Value>,
    pub paused: bool,
    pub position_ms: u64,
    pub duration_ms: u64,
}

struct Session {
    nonce: String,
    bootstrap_served: Mutex<bool>,
    status: Mutex<HeadlessStatus>,
    commands: Mutex<VecDeque<Value>>,
    child: Mutex<Child>,
    server: Mutex<Option<tokio::task::JoinHandle<()>>>,
    ready: Notify,
}

static SESSION: Mutex<Option<Arc<Session>>> = Mutex::const_new(None);

fn random_nonce() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn html(base: &str) -> String {
    include_str!("headless-player.html").replace("__BASE__", base)
}

async fn reply(socket: &mut TcpStream, code: &str, content_type: &str, body: &[u8]) -> Result<()> {
    let header = format!("HTTP/1.1 {code}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", body.len());
    socket.write_all(header.as_bytes()).await?;
    socket.write_all(body).await?;
    Ok(())
}

async fn handle(mut socket: TcpStream, session: Arc<Session>) -> Result<()> {
    let mut data = Vec::with_capacity(4096);
    let header_end = loop {
        let mut chunk = [0_u8; 4096];
        let count = socket.read(&mut chunk).await?;
        if count == 0 { return Ok(()); }
        data.extend_from_slice(&chunk[..count]);
        if data.len() > 65536 { bail!("Spotify helper request too large"); }
        if let Some(end) = data.windows(4).position(|window| window == b"\r\n\r\n") { break end + 4; }
    };
    let header = String::from_utf8(data[..header_end].to_vec())?;
    let mut request = header.lines().next().unwrap_or("").split_whitespace();
    let method = request.next().unwrap_or("");
    let path = request.next().unwrap_or("");
    let base = format!("/{}", session.nonce);
    if method == "GET" && path == "/player" {
        let mut served = session.bootstrap_served.lock().await;
        if !*served {
            *served = true;
            return reply(&mut socket, "200 OK", "text/html; charset=utf-8", html(&base).as_bytes()).await;
        }
    }
    if !path.starts_with(&base) {
        return reply(&mut socket, "404 Not Found", "text/plain", b"Not found").await;
    }
    let length: usize = header.lines().find_map(|line| {
        line.split_once(':').filter(|(name, _)| name.eq_ignore_ascii_case("content-length"))
            .and_then(|(_, value)| value.trim().parse().ok())
    }).unwrap_or(0);
    if length > 65536 { bail!("Spotify helper body too large"); }
    while data.len() < header_end + length {
        let mut chunk = [0_u8; 4096];
        let count = socket.read(&mut chunk).await?;
        if count == 0 { bail!("Incomplete Spotify helper request"); }
        data.extend_from_slice(&chunk[..count]);
    }
    let body = &data[header_end..header_end + length];
    let route = &path[base.len()..];
    match (method, route) {
        ("GET", "/token") => {
            let token = access_token().await?;
            reply(&mut socket, "200 OK", "application/json", serde_json::to_vec(&json!({"token": token}))?.as_slice()).await
        }
        ("GET", "/commands") => {
            let commands: Vec<Value> = session.commands.lock().await.drain(..).collect();
            reply(&mut socket, "200 OK", "application/json", serde_json::to_vec(&commands)?.as_slice()).await
        }
        ("POST", "/ready") => {
            let value: Value = serde_json::from_slice(body)?;
            let mut status = session.status.lock().await;
            status.device_id = value["device_id"].as_str().map(ToOwned::to_owned);
            status.ready = status.device_id.is_some();
            status.error.clear();
            session.ready.notify_one();
            reply(&mut socket, "204 No Content", "text/plain", b"").await
        }
        ("POST", "/state") => {
            let value: Value = serde_json::from_slice(body)?;
            let mut status = session.status.lock().await;
            status.track = value.get("track").filter(|track| !track.is_null()).cloned();
            status.paused = value["paused"].as_bool().unwrap_or(true);
            status.position_ms = value["position_ms"].as_u64().unwrap_or(0);
            status.duration_ms = value["duration_ms"].as_u64().unwrap_or(0);
            reply(&mut socket, "204 No Content", "text/plain", b"").await
        }
        ("POST", "/error") => {
            let value: Value = serde_json::from_slice(body)?;
            session.status.lock().await.error = value["message"].as_str().unwrap_or("Spotify playback error").to_string();
            session.ready.notify_one();
            reply(&mut socket, "204 No Content", "text/plain", b"").await
        }
        _ => reply(&mut socket, "404 Not Found", "text/plain", b"Not found").await,
    }
}

async fn start_session() -> Result<Arc<Session>> {
    let mut guard = SESSION.lock().await;
    if let Some(session) = guard.as_ref() {
        if session.child.lock().await.try_wait()?.is_none() { return Ok(session.clone()); }
    }
    if let Some(old) = guard.take() {
        if let Some(server) = old.server.lock().await.take() { server.abort(); }
    }
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let nonce = random_nonce();
    let profile = crate::types::constants::data_path().join("spotify-chrome");
    std::fs::create_dir_all(&profile)?;
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&profile, std::fs::Permissions::from_mode(0o700))?;
    let executable = ["google-chrome", "google-chrome-stable", "chromium"]
        .into_iter().find(|name| std::process::Command::new("which").arg(name).output().is_ok_and(|out| out.status.success()))
        .context("Chrome is required for in-app Spotify playback on this Linux build")?;
    let mut chrome = Command::new(executable);
    chrome
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--autoplay-policy=no-user-gesture-required")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg(format!("http://127.0.0.1:{port}/player"))
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
        .kill_on_drop(true);
    // The audio process must not outlive the app, including after a forced exit.
    unsafe {
        chrome.as_std_mut().pre_exec(|| {
            if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) == -1 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }
    let child = chrome.spawn()?;
    let session = Arc::new(Session {
        nonce,
        bootstrap_served: Mutex::new(false),
        status: Mutex::new(HeadlessStatus { paused: true, ..Default::default() }),
        commands: Mutex::new(VecDeque::new()),
        child: Mutex::new(child),
        server: Mutex::new(None),
        ready: Notify::new(),
    });
    let server_session = session.clone();
    let server = tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let session = server_session.clone();
            tokio::spawn(async move { if let Err(error) = handle(socket, session).await { log::warn!("Spotify audio helper: {error:#}"); } });
        }
    });
    *session.server.lock().await = Some(server);
    *guard = Some(session.clone());
    Ok(session)
}

pub async fn shutdown() {
    if let Some(session) = SESSION.lock().await.take() {
        let _ = session.child.lock().await.kill().await;
        if let Some(server) = session.server.lock().await.take() { server.abort(); }
    }
}

#[tauri::command]
pub async fn spotify_headless_start() -> Result<ApplicationResp<HeadlessStatus>, InvokeError> {
    let session = start_session().await.map_err(InvokeError::from_anyhow)?;
    let wait = async {
        loop {
            let status = session.status.lock().await.clone();
            if status.ready || !status.error.is_empty() { return status; }
            session.ready.notified().await;
        }
    };
    let status = tokio::time::timeout(Duration::from_secs(30), wait).await
        .map_err(|_| InvokeError::from_anyhow(anyhow::anyhow!("Spotify audio engine did not start")))?;
    if !status.error.is_empty() { return Err(InvokeError::from_anyhow(anyhow::anyhow!(status.error))); }
    Ok(ApplicationResp::success_data(status))
}

#[tauri::command]
pub async fn spotify_headless_status() -> Result<ApplicationResp<HeadlessStatus>, InvokeError> {
    let session = SESSION.lock().await.clone().context("Spotify audio engine is not running").map_err(InvokeError::from_anyhow)?;
    let status = session.status.lock().await.clone();
    Ok(ApplicationResp::success_data(status))
}

#[tauri::command]
pub async fn spotify_headless_command(action: String, value: Option<f64>) -> Result<ApplicationResp<()>, InvokeError> {
    if !matches!(action.as_str(), "toggle" | "pause" | "next" | "previous" | "seek" | "volume") {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify audio command")));
    }
    if value.is_some_and(|value| !value.is_finite()) { return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify audio value"))); }
    let session = SESSION.lock().await.clone().context("Spotify audio engine is not running").map_err(InvokeError::from_anyhow)?;
    session.commands.lock().await.push_back(json!({"action": action, "value": value}));
    Ok(ApplicationResp::success())
}
