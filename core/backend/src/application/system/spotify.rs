use crate::application::resp::ApplicationResp;
use crate::types::constants::data_path;
use anyhow::{bail, Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::{HashMap, HashSet};
use crate::application::recommendation_engine::{self, Candidate};
use tauri::ipc::InvokeError;
use tauri_plugin_shell::ShellExt;
#[cfg(not(target_os = "android"))]
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpListener};
use tokio::sync::Mutex;

pub mod headless;

// Spotify's client ID is public. The client secret and account password are never used by PKCE.
const CLIENT_ID: &str = "bbfec9aceea04e3699a54bdbb85654b0";
#[cfg(target_os = "android")]
const REDIRECT_URI: &str = "case-music://spotify-auth-complete";
#[cfg(not(target_os = "android"))]
const REDIRECT_URI: &str = "http://127.0.0.1:3000";
const TOKEN_FILE: &str = "spotify-token.json";
const PENDING_AUTH_FILE: &str = "spotify-pending-auth.json";
const SCOPES: &str = "playlist-read-private playlist-read-collaborative user-library-read user-library-modify user-modify-playback-state streaming";

static PENDING: Mutex<Option<PendingAuth>> = Mutex::const_new(None);
static TOKEN: Mutex<Option<StoredToken>> = Mutex::const_new(None);
static CALLBACK_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::const_new(None);
static AUTH_ERROR: Mutex<Option<String>> = Mutex::const_new(None);
#[cfg(target_os = "android")]
static AUTH_FINISH_LOCK: Mutex<()> = Mutex::const_new(());

#[derive(Clone, Serialize, Deserialize)]
struct PendingAuth { state: String, verifier: String, expires_at: u64 }

#[derive(Clone, Serialize, Deserialize)]
struct StoredToken {
    access_token: String,
    refresh_token: String,
    expires_at: u64,
    #[serde(default)]
    scope: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    #[serde(default)]
    scope: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct SpotifyStatus { pub connected: bool, pub streaming_authorized: bool, pub authorization_error: Option<String> }

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }

async fn save_pending_auth(pending: &PendingAuth) -> Result<()> {
    let path = data_path().join(PENDING_AUTH_FILE);
    if let Some(parent) = path.parent() { tokio::fs::create_dir_all(parent).await?; }
    let data = serde_json::to_vec(pending)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path)?;
        file.write_all(&data)?;
    }
    #[cfg(not(unix))]
    tokio::fs::write(path, data).await?;
    Ok(())
}

async fn pending_auth() -> Result<Option<PendingAuth>> {
    if let Some(pending) = PENDING.lock().await.clone() { return Ok(Some(pending)); }
    let path = data_path().join(PENDING_AUTH_FILE);
    let data = match tokio::fs::read(path).await {
        Ok(data) => data,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    Ok(Some(serde_json::from_slice(&data)?))
}

async fn clear_pending_auth() {
    *PENDING.lock().await = None;
    let _ = tokio::fs::remove_file(data_path().join(PENDING_AUTH_FILE)).await;
}

fn random_url_safe(bytes: usize) -> String {
    let mut value = vec![0; bytes];
    OsRng.fill_bytes(&mut value);
    URL_SAFE_NO_PAD.encode(value)
}

async fn save_token(token: &StoredToken) -> Result<()> {
    let path = data_path().join(TOKEN_FILE);
    if let Some(parent) = path.parent() { tokio::fs::create_dir_all(parent).await?; }
    let data = serde_json::to_vec(token)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true).mode(0o600);
        let mut file = options.open(&path)?;
        use std::io::Write;
        file.write_all(&data)?;
    }
    #[cfg(not(unix))]
    tokio::fs::write(path, data).await?;
    Ok(())
}

async fn stored_token() -> Result<Option<StoredToken>> {
    let mut guard = TOKEN.lock().await;
    if guard.is_none() {
        if let Ok(data) = tokio::fs::read(data_path().join(TOKEN_FILE)).await {
            *guard = Some(serde_json::from_slice(&data)?);
        }
    }
    Ok(guard.clone())
}

async fn access_token() -> Result<String> {
    let mut token = stored_token().await?.context("Spotify is not connected")?;
    if token.expires_at <= now() + 60 {
        let response = Client::new().post("https://accounts.spotify.com/api/token")
            .form(&[("grant_type", "refresh_token"), ("refresh_token", token.refresh_token.as_str()), ("client_id", CLIENT_ID)])
            .send().await?.error_for_status()?;
        let refreshed: TokenResponse = response.json().await?;
        token.access_token = refreshed.access_token;
        token.refresh_token = refreshed.refresh_token.unwrap_or(token.refresh_token);
        token.expires_at = now() + refreshed.expires_in;
        if !refreshed.scope.is_empty() { token.scope = refreshed.scope; }
        save_token(&token).await?;
        *TOKEN.lock().await = Some(token.clone());
    }
    Ok(token.access_token)
}

async fn api_get(path: &str, params: &[(&str, String)]) -> Result<Value> {
    let token = access_token().await?;
    let mut url = Url::parse(&format!("https://api.spotify.com/v1/{path}"))?;
    url.query_pairs_mut().extend_pairs(params.iter().map(|(key, value)| (*key, value.as_str())));
    let response = Client::new().get(url).bearer_auth(token).send().await?;
    let status = response.status();
    if !status.is_success() { bail!("Spotify API returned {status}"); }
    Ok(response.json().await?)
}

async fn exchange_code(code: &str, verifier: &str) -> Result<()> {
    let response = Client::new().post("https://accounts.spotify.com/api/token")
        .form(&[("grant_type", "authorization_code"), ("code", code), ("redirect_uri", REDIRECT_URI), ("client_id", CLIENT_ID), ("code_verifier", verifier)])
        .send().await?.error_for_status()?;
    let token: TokenResponse = response.json().await?;
    let stored = StoredToken {
        access_token: token.access_token,
        refresh_token: token.refresh_token.context("Spotify did not provide a refresh token")?,
        expires_at: now() + token.expires_in,
        scope: token.scope,
    };
    save_token(&stored).await?;
    *TOKEN.lock().await = Some(stored);
    Ok(())
}

async fn complete_authorization(url: &Url) -> Result<()> {
    let redirect = Url::parse(REDIRECT_URI)?;
    if url.scheme() != redirect.scheme() || url.host_str() != redirect.host_str() || url.port() != redirect.port() {
        bail!("Unexpected Spotify callback URL");
    }
    let values: HashMap<_, _> = url.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
    let pending = pending_auth().await?.context("No Spotify authorization pending")?;
    if pending.expires_at <= now() {
        clear_pending_auth().await;
        bail!("Spotify authorization expired. Please try again.");
    }
    if values.get("state") != Some(&pending.state) { bail!("Spotify authorization state mismatch"); }
    let result = if let Some(error) = values.get("error") {
        Err(anyhow::anyhow!("Spotify authorization was denied: {error}"))
    } else {
        let code = values.get("code").context("Spotify authorization code is missing")?;
        exchange_code(code, &pending.verifier).await
    };
    clear_pending_auth().await;
    result
}

async fn handle_auth_url(url: &Url) -> Result<()> {
    let result = complete_authorization(url).await;
    if let Err(error) = &result {
        log::warn!("Spotify authorization failed: {error:#}");
        *AUTH_ERROR.lock().await = Some(format!("Spotify authorization failed: {error:#}"));
    } else {
        *AUTH_ERROR.lock().await = None;
    }
    result
}

#[cfg(target_os = "android")]
pub async fn handle_deep_link(raw_url: String) {
    let Ok(url) = Url::parse(&raw_url) else { return; };
    if url.scheme() != "case-music" || url.host_str() != Some("spotify-auth-complete") { return; }
    if !url.query_pairs().any(|(key, _)| key == "code" || key == "error") { return; }
    let _guard = AUTH_FINISH_LOCK.lock().await;
    if pending_auth().await.ok().flatten().is_none() {
        return;
    }
    let _ = handle_auth_url(&url).await;
}

#[cfg(not(target_os = "android"))]
async fn receive_callback(listener: TcpListener) -> Result<()> {
    let (mut socket, _) = listener.accept().await?;
    let mut buffer = [0_u8; 8192];
    let length = socket.read(&mut buffer).await?;
    let request = std::str::from_utf8(&buffer[..length])?;
    let path = request.split_whitespace().nth(1).context("Missing callback path")?;
    let url = Url::parse(&format!("{REDIRECT_URI}{path}"))?;
    let result = handle_auth_url(&url).await;
    let message = if result.is_ok() { "Spotify connected." } else { "Spotify connection failed. Return to Case Music and try again." };
    let body = format!("<html><meta name=\"viewport\" content=\"width=device-width\"><body><h2>{message}</h2><script>history.replaceState(null,'','/')</script></body></html>");
    let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
    socket.write_all(reply.as_bytes()).await?;
    Ok(())
}

#[tauri::command]
pub async fn spotify_auth_start() -> Result<ApplicationResp<String>, InvokeError> {
    if let Some(task) = CALLBACK_TASK.lock().await.take() { task.abort(); }
    *AUTH_ERROR.lock().await = None;
    #[cfg(not(target_os = "android"))]
    let listener = TcpListener::bind("127.0.0.1:3000").await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    let verifier = random_url_safe(48);
    let state = random_url_safe(24);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let pending = PendingAuth { state: state.clone(), verifier, expires_at: now() + 300 };
    save_pending_auth(&pending).await.map_err(InvokeError::from_anyhow)?;
    *PENDING.lock().await = Some(pending);
    #[cfg(not(target_os = "android"))]
    {
        *CALLBACK_TASK.lock().await = Some(tokio::spawn(async move {
            match tokio::time::timeout(std::time::Duration::from_secs(300), receive_callback(listener)).await {
                Ok(Err(error)) => log::warn!("Spotify callback failed: {error:#}"),
                Err(_) => {
                    clear_pending_auth().await;
                    *AUTH_ERROR.lock().await = Some("Spotify authorization timed out. Please try again.".into());
                },
                _ => {}
            }
        }));
    }
    #[cfg(target_os = "android")]
    {
        *CALLBACK_TASK.lock().await = Some(tokio::spawn(async {
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
            if pending_auth().await.ok().flatten().is_some_and(|pending| pending.expires_at <= now()) {
                clear_pending_auth().await;
                *AUTH_ERROR.lock().await = Some("Spotify authorization timed out. Please try again.".into());
            }
        }));
    }
    let mut url = Url::parse("https://accounts.spotify.com/authorize").map_err(|error| InvokeError::from_anyhow(error.into()))?;
    url.query_pairs_mut().append_pair("client_id", CLIENT_ID).append_pair("response_type", "code")
        .append_pair("redirect_uri", REDIRECT_URI).append_pair("scope", SCOPES)
        .append_pair("state", &state).append_pair("code_challenge_method", "S256")
        .append_pair("code_challenge", &challenge);
    Ok(ApplicationResp::success_data(url.to_string()))
}

#[tauri::command]
#[allow(deprecated)]
pub fn spotify_auth_open<R: tauri::Runtime>(app: tauri::AppHandle<R>, url: String) -> Result<ApplicationResp<()>, InvokeError> {
    let parsed = Url::parse(&url).map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if parsed.scheme() != "https" || parsed.host_str() != Some("accounts.spotify.com") || parsed.path() != "/authorize" {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify authorization URL")));
    }
    app.shell().open(url, None).map_err(|error| InvokeError::from_anyhow(error.into()))?;
    Ok(ApplicationResp::success())
}

#[tauri::command]
pub async fn spotify_status() -> Result<ApplicationResp<SpotifyStatus>, InvokeError> {
    let stored = stored_token().await.map_err(InvokeError::from_anyhow)?;
    let connected = if stored.is_some() {
        access_token().await.is_ok()
    } else { false };
    let streaming_authorized = stored.as_ref().is_some_and(|token| token.scope.split_whitespace().any(|scope| scope == "streaming"));
    let authorization_error = AUTH_ERROR.lock().await.clone();
    Ok(ApplicationResp::success_data(SpotifyStatus { connected, streaming_authorized, authorization_error }))
}

#[tauri::command]
pub async fn spotify_access_token() -> Result<ApplicationResp<String>, InvokeError> {
    let token = access_token().await.map_err(InvokeError::from_anyhow)?;
    Ok(ApplicationResp::success_data(token))
}

#[tauri::command]
pub async fn spotify_disconnect() -> Result<ApplicationResp<()>, InvokeError> {
    headless::shutdown().await;
    if let Some(task) = CALLBACK_TASK.lock().await.take() { task.abort(); }
    *TOKEN.lock().await = None;
    clear_pending_auth().await;
    *AUTH_ERROR.lock().await = None;
    let _ = tokio::fs::remove_file(data_path().join(TOKEN_FILE)).await;
    Ok(ApplicationResp::success())
}

#[tauri::command]
pub async fn spotify_playlists() -> Result<ApplicationResp<Value>, InvokeError> {
    let mut all = Vec::new();
    let mut offset = 0;
    loop {
        let page = api_get("me/playlists", &[("limit", "50".into()), ("offset", offset.to_string())]).await.map_err(InvokeError::from_anyhow)?;
        let items = page["items"].as_array().cloned().unwrap_or_default();
        let count = items.len();
        all.extend(items);
        offset += count;
        if count == 0 || offset >= page["total"].as_u64().unwrap_or(0) as usize { break; }
    }
    Ok(ApplicationResp::success_data(Value::Array(all)))
}

#[tauri::command]
pub async fn spotify_playlist_items(id: String, offset: u32) -> Result<ApplicationResp<Value>, InvokeError> {
    if !id.chars().all(|ch| ch.is_ascii_alphanumeric()) || id.is_empty() { return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid playlist ID"))); }
    let value = api_get(&format!("playlists/{id}/items"), &[("limit", "50".into()), ("offset", offset.to_string())]).await.map_err(InvokeError::from_anyhow)?;
    Ok(ApplicationResp::success_data(value))
}

#[tauri::command]
pub async fn spotify_saved_tracks(offset: u32) -> Result<ApplicationResp<Value>, InvokeError> {
    let value = api_get("me/tracks", &[("limit", "50".into()), ("offset", offset.to_string())]).await.map_err(InvokeError::from_anyhow)?;
    Ok(ApplicationResp::success_data(value))
}

#[tauri::command]
pub async fn spotify_library_contains(ids: Vec<String>) -> Result<ApplicationResp<Vec<bool>>, InvokeError> {
    if ids.len() > 40 || ids.iter().any(|id| id.is_empty() || !id.chars().all(|ch| ch.is_ascii_alphanumeric())) {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify track IDs")));
    }
    if ids.is_empty() { return Ok(ApplicationResp::success_data(Vec::new())); }
    let uris = ids.iter().map(|id| format!("spotify:track:{id}")).collect::<Vec<_>>().join(",");
    let value = api_get("me/library/contains", &[("uris", uris)]).await.map_err(InvokeError::from_anyhow)?;
    let liked = value.as_array().map(|items| items.iter().map(|item| item.as_bool().unwrap_or(false)).collect()).unwrap_or_default();
    Ok(ApplicationResp::success_data(liked))
}

#[tauri::command]
pub async fn spotify_set_liked(id: String, liked: bool) -> Result<ApplicationResp<()>, InvokeError> {
    if id.is_empty() || !id.chars().all(|ch| ch.is_ascii_alphanumeric()) {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify track ID")));
    }
    let scope = stored_token().await.map_err(InvokeError::from_anyhow)?
        .map(|token| token.scope).unwrap_or_default();
    if !scope.split_whitespace().any(|item| item == "user-library-modify") {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Reconnect Spotify in Settings to grant library access")));
    }
    let token = access_token().await.map_err(InvokeError::from_anyhow)?;
    let mut url = Url::parse("https://api.spotify.com/v1/me/library").map_err(|error| InvokeError::from_anyhow(error.into()))?;
    url.query_pairs_mut().append_pair("uris", &format!("spotify:track:{id}"));
    let client = Client::new();
    let request = if liked { client.put(url) } else { client.delete(url) };
    let response = request.bearer_auth(token).send().await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if !response.status().is_success() {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Spotify library update failed ({})", response.status())));
    }
    Ok(ApplicationResp::success())
}

async fn spotify_artist_genres(ids: &[String]) -> Result<HashMap<String, Vec<String>>> {
    let unique: Vec<_> = ids.iter().filter(|id| !id.is_empty() && id.chars().all(|ch| ch.is_ascii_alphanumeric()))
        .cloned().collect::<HashSet<_>>().into_iter().collect();
    let mut result = HashMap::new();
    for batch in unique.chunks(50) {
        let response = api_get("artists", &[("ids", batch.join(","))]).await?;
        if let Some(artists) = response["artists"].as_array() {
            for artist in artists {
                let Some(id) = artist["id"].as_str() else { continue; };
                let genres = artist["genres"].as_array().map(|values| values.iter()
                    .filter_map(|value| value.as_str().map(str::to_string)).collect()).unwrap_or_default();
                result.insert(id.to_string(), genres);
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn spotify_random_recommendations(seed_track_id: Option<String>, excluded_track_ids: Option<Vec<String>>) -> Result<ApplicationResp<Value>, InvokeError> {
    // Spotify metadata remains local; it is never passed to an AI service.
    let seed = if let Some(id) = seed_track_id.as_ref() {
        if id.is_empty() || !id.chars().all(|ch| ch.is_ascii_alphanumeric()) {
            return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify track ID")));
        }
        Some(api_get(&format!("tracks/{id}"), &[]).await.map_err(InvokeError::from_anyhow)?)
    } else { None };
    let excluded_track_ids = excluded_track_ids.unwrap_or_default();
    if excluded_track_ids.len() > 160 || excluded_track_ids.iter().any(|id| id.is_empty() || !id.chars().all(|ch| ch.is_ascii_alphanumeric())) {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid excluded Spotify track IDs")));
    }
    let excluded_track_ids: HashSet<_> = excluded_track_ids.into_iter().collect();
    let mut saved_ids = HashSet::new();
    let mut artist_counts = HashMap::<String, (String, usize)>::new();
    let mut offset = 0;
    loop {
        let page = api_get("me/tracks", &[("limit", "50".into()), ("offset", offset.to_string())])
            .await.map_err(InvokeError::from_anyhow)?;
        let items = page["items"].as_array().cloned().unwrap_or_default();
        let count = items.len();
        for item in &items {
            let track = &item["track"];
            if let Some(id) = track["id"].as_str() { saved_ids.insert(id.to_string()); }
            if let (Some(id), Some(name)) = (track["artists"][0]["id"].as_str(), track["artists"][0]["name"].as_str()) {
                let entry = artist_counts.entry(id.to_string()).or_insert((name.to_string(), 0));
                entry.1 += 1;
            }
        }
        offset += count;
        if count == 0 || offset >= page["total"].as_u64().unwrap_or(0) as usize { break; }
    }
    if artist_counts.is_empty() && seed.is_none() {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Add some Spotify liked tracks before generating recommendations")));
    }

    let seed_artist_id = seed.as_ref().and_then(|track| track["artists"][0]["id"].as_str()).map(str::to_string);
    let mut favorite_artists: Vec<_> = artist_counts.iter().collect();
    favorite_artists.sort_by(|a, b| b.1.1.cmp(&a.1.1));
    let mut profile_ids: Vec<String> = favorite_artists.iter().take(24).map(|(id, _)| (*id).clone()).collect();
    if let Some(id) = &seed_artist_id {
        profile_ids.retain(|candidate| candidate != id);
        profile_ids.insert(0, id.clone());
    }
    let profiles = spotify_artist_genres(&profile_ids).await.map_err(InvokeError::from_anyhow)?;
    let mut family_counts = HashMap::<String, usize>::new();
    let mut style_counts = HashMap::<String, usize>::new();
    for (id, (_, count)) in favorite_artists.iter().take(24) {
        if let Some(genres) = profiles.get(*id) {
            let mut seen_families = HashSet::new();
            for genre in genres {
                let family = recommendation_engine::major_style(genre);
                if seen_families.insert(family.clone()) { *family_counts.entry(family).or_default() += *count; }
                *style_counts.entry(genre.clone()).or_default() += *count;
            }
        }
    }
    let favorite_family = family_counts.into_iter().max_by_key(|(_, count)| *count).map(|(family, _)| family);
    let primary_style = if let Some(id) = &seed_artist_id {
        profiles.get(id).and_then(|genres| genres.iter().find(|genre| favorite_family.as_deref() == Some(recommendation_engine::major_style(genre).as_str())).or_else(|| genres.first())).cloned()
    } else {
        style_counts.into_iter().filter(|(style, _)| favorite_family.as_deref() == Some(recommendation_engine::major_style(style).as_str()))
            .max_by_key(|(_, count)| *count).map(|(style, _)| style)
    }.ok_or_else(|| InvokeError::from_anyhow(anyhow::anyhow!("Spotify has no style metadata for the selected artists")))?;
    let broad_style = match recommendation_engine::major_style(&primary_style).as_str() {
        "rnb" => "r&b", "hiphop" => "hip-hop", "rock" => "rock", "pop" => "pop",
        "electronic" => "electronic", "jazz" => "jazz", "classical" => "classical",
        "country" => "country", "folk" => "folk", "metal" => "metal",
        "reggae" => "reggae", "latin" => "latin", "blues" => "blues",
        _ => primary_style.as_str(),
    };
    let mut styles = vec![broad_style.to_string()];
    if !styles.contains(&primary_style) { styles.push(primary_style.clone()); }
    for genres in profiles.values() {
        for genre in genres {
            if recommendation_engine::same_major_style(&primary_style, genre) && !styles.contains(genre) {
                styles.push(genre.clone());
            }
        }
    }
    styles.truncate(4);
    let current_year = time::OffsetDateTime::now_utc().year();
    let mut candidates = Vec::<Candidate<String>>::new();
    let mut tracks = HashMap::<String, Value>::new();
    let mut candidate_order = Vec::new();
    let mut first_error = None;
    let mut queries = Vec::new();
    if let Some(seed) = &seed {
        if let Some(artist) = seed["artists"][0]["name"].as_str() {
            queries.push(format!("artist:\"{}\"", artist.replace('"', "")));
        }
    }
    for style in &styles {
        let genre = style.replace('"', "");
        queries.push(format!("genre:\"{genre}\" year:{current_year}"));
        for decade in (1960..=(current_year / 10 * 10)).step_by(10) {
            let end = (decade + 9).min(current_year);
            if decade <= end { queries.push(format!("genre:\"{genre}\" year:{decade}-{end}")); }
        }
    }
    for (_, (artist, _)) in favorite_artists.iter().take(4) {
        queries.push(format!("artist:\"{}\"", artist.replace('"', "")));
    }
    for query in queries {
        let random_offset = if query.ends_with(&format!("year:{current_year}")) { 0 } else { OsRng.next_u32() % 4 * 10 };
        let search = api_get("search", &[("q", query), ("type", "track".into()), ("limit", "10".into()), ("offset", random_offset.to_string())]).await;
        let search = match search {
            Ok(value) => value,
            Err(error) => { if first_error.is_none() { first_error = Some(error.to_string()); } continue; }
        };
        if let Some(items) = search["tracks"]["items"].as_array() {
            for track in items {
                let Some(id) = track["id"].as_str() else { continue; };
                if saved_ids.contains(id) || excluded_track_ids.contains(id) || seed_track_id.as_deref() == Some(id) || tracks.contains_key(id) || track["is_playable"] == false { continue; }
                candidate_order.push(id.to_string());
                tracks.insert(id.to_string(), track.clone());
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(120)).await;
    }
    if tracks.is_empty() {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!(first_error.unwrap_or_else(|| "No Spotify recommendations were found".into()))));
    }
    let artist_ids: Vec<_> = tracks.values().filter_map(|track| track["artists"][0]["id"].as_str().map(str::to_string)).collect();
    let artist_genres = spotify_artist_genres(&artist_ids).await.map_err(InvokeError::from_anyhow)?;
    for id in &candidate_order {
        let track = &tracks[id];
        let (Some(artist_id), Some(artist)) = (track["artists"][0]["id"].as_str(), track["artists"][0]["name"].as_str()) else { continue; };
        let Some(style) = artist_genres.get(artist_id).and_then(|genres| genres.iter().find(|genre| recommendation_engine::same_major_style(&primary_style, genre))) else { continue; };
        let album_name = track["album"]["name"].as_str().unwrap_or("").to_lowercase();
        let track_name = track["name"].as_str().unwrap_or("").to_lowercase();
        if ["remaster", "reissue", "live", "re-record", "rerecord"].iter().any(|term| album_name.contains(term) || track_name.contains(term)) { continue; }
        let year = track["album"]["release_date"].as_str().and_then(|date| date.get(..4)).and_then(|year| year.parse::<i32>().ok());
        candidates.push(Candidate {
            id: id.clone(), artist: artist.to_lowercase(), year, style: style.clone(),
            familiar_artist: artist_counts.contains_key(artist_id),
            seed_artist: seed_artist_id.as_deref() == Some(artist_id),
        });
    }
    let selected = recommendation_engine::select_balanced(&candidates, 15, &primary_style, current_year);
    if selected.is_empty() { return Err(InvokeError::from_anyhow(anyhow::anyhow!("No Spotify songs matched the selected primary style"))); }
    Ok(ApplicationResp::success_data(Value::Array(selected.into_iter().filter_map(|id| tracks.remove(&id)).collect())))
}

#[tauri::command]
pub async fn spotify_play_track(id: String) -> Result<ApplicationResp<()>, InvokeError> {
    if !id.chars().all(|ch| ch.is_ascii_alphanumeric()) || id.is_empty() {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid track ID")));
    }
    let token = access_token().await.map_err(InvokeError::from_anyhow)?;
    let response = Client::new().put("https://api.spotify.com/v1/me/player/play")
        .bearer_auth(token).json(&serde_json::json!({"uris": [format!("spotify:track:{id}")]}))
        .send().await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Spotify playback failed ({status}). Open Spotify on a device and confirm Premium is active.")));
    }
    Ok(ApplicationResp::success())
}

#[tauri::command]
pub async fn spotify_play_playlist(id: String) -> Result<ApplicationResp<()>, InvokeError> {
    if !id.chars().all(|ch| ch.is_ascii_alphanumeric()) || id.is_empty() {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid playlist ID")));
    }
    let token = access_token().await.map_err(InvokeError::from_anyhow)?;
    let response = Client::new().put("https://api.spotify.com/v1/me/player/play")
        .bearer_auth(token).json(&serde_json::json!({"context_uri": format!("spotify:playlist:{id}")}))
        .send().await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Spotify playback failed ({status}). Open Spotify on a device and confirm Premium is active.")));
    }
    Ok(ApplicationResp::success())
}

#[tauri::command]
pub async fn spotify_player_action(action: String) -> Result<ApplicationResp<()>, InvokeError> {
    let (method, endpoint) = match action.as_str() {
        "pause" => (reqwest::Method::PUT, "pause"),
        "next" => (reqwest::Method::POST, "next"),
        "previous" => (reqwest::Method::POST, "previous"),
        _ => return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify player action"))),
    };
    let token = access_token().await.map_err(InvokeError::from_anyhow)?;
    let response = Client::new().request(method, format!("https://api.spotify.com/v1/me/player/{endpoint}"))
        .bearer_auth(token).send().await.map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Spotify player action failed ({status})")));
    }
    Ok(ApplicationResp::success())
}

#[derive(Deserialize)]
pub struct SpotifyStartReq {
    pub device_id: String,
    pub track_ids: Vec<String>,
    pub playlist_id: Option<String>,
    pub offset_track_id: Option<String>,
}

fn valid_spotify_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|ch| ch.is_ascii_alphanumeric())
}

#[tauri::command]
pub async fn spotify_start_playback(req: SpotifyStartReq) -> Result<ApplicationResp<()>, InvokeError> {
    if !valid_spotify_id(&req.device_id)
        || req.track_ids.iter().any(|id| !valid_spotify_id(id))
        || req.playlist_id.as_deref().is_some_and(|id| !valid_spotify_id(id))
        || req.offset_track_id.as_deref().is_some_and(|id| !valid_spotify_id(id))
    {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid Spotify playback ID")));
    }
    let body = if let Some(id) = req.playlist_id {
        let mut body = serde_json::json!({"context_uri": format!("spotify:playlist:{id}")});
        if let Some(track) = req.offset_track_id {
            body["offset"] = serde_json::json!({"uri": format!("spotify:track:{track}")});
        }
        body
    } else {
        if req.track_ids.is_empty() || req.track_ids.len() > 100 {
            return Err(InvokeError::from_anyhow(anyhow::anyhow!("Spotify playback needs 1-100 tracks")));
        }
        serde_json::json!({"uris": req.track_ids.iter().map(|id| format!("spotify:track:{id}")).collect::<Vec<_>>()})
    };
    let token = access_token().await.map_err(InvokeError::from_anyhow)?;
    let mut url = Url::parse("https://api.spotify.com/v1/me/player/play").map_err(|error| InvokeError::from_anyhow(error.into()))?;
    url.query_pairs_mut().append_pair("device_id", &req.device_id);
    let response = Client::new().put(url).bearer_auth(token).json(&body).send().await
        .map_err(|error| InvokeError::from_anyhow(error.into()))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Spotify playback failed ({status})")));
    }
    Ok(ApplicationResp::success())
}
