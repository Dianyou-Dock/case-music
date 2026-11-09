use crate::{application::resp::ApplicationResp, types::constants::MusicSource, INSTANCE};
use anyhow::{Context, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::HashSet, time::Duration};
use tauri::ipc::InvokeError;
use tokio::sync::Mutex;

static MB_GATE: Mutex<()> = Mutex::const_new(());
fn norm(value: &str) -> String { value.trim().to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ") }
async fn mb(path: &str, params: &[(&str, String)]) -> Result<Value> {
    let _gate = MB_GATE.lock().await;
    let response = reqwest::Client::new().get(format!("https://musicbrainz.org/ws/2/{path}"))
        .query(&[("fmt", "json")]).query(params)
        .header(reqwest::header::USER_AGENT, "case-music/0.1.38 (music discovery)")
        .timeout(Duration::from_secs(12)).send().await?.error_for_status()?;
    let value = response.json().await?;
    tokio::time::sleep(Duration::from_millis(1100)).await;
    Ok(value)
}

#[derive(Deserialize)]
pub struct DailyArtistsReq { samples: Vec<Value>, excluded_artists: Vec<String>, language: String }
#[tauri::command]
pub async fn daily_artists(req: DailyArtistsReq) -> Result<ApplicationResp<Vec<Value>>, InvokeError> {
    if req.samples.is_empty() || req.samples.len() > 20 || req.excluded_artists.len() > 2000 {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid discovery request")));
    }
    let mut names = {
        let instance = INSTANCE.read().await;
        let ai = instance.ai.as_ref().context("请先在设置中配置 AI 音源").map_err(InvokeError::from_anyhow)?;
        ai.recommend_daily_artists(&req.samples, &req.excluded_artists, &req.language).await.map_err(InvokeError::from_anyhow)?
    };
    let excluded: HashSet<_> = req.excluded_artists.iter().map(|v| norm(v)).collect();
    let mut seen = HashSet::new();
    let mut matching = Vec::new();
    let mut other = Vec::new();
    for round in 0..5 {
        for candidate in names.drain(..) {
            if matching.len() >= 5 && other.len() >= 15 { break; }
            let language_match = candidate["language_match"].as_bool().unwrap_or(false);
            let Some(candidate) = candidate["name"].as_str() else { continue; };
            if language_match && matching.len() >= 5 || !language_match && other.len() >= 15 { continue; }
            if candidate.len() > 120 || candidate.is_empty() || excluded.contains(&norm(&candidate)) || !seen.insert(norm(&candidate)) { continue; }
            let Ok(found) = mb("artist/", &[("query", candidate.replace('"', "")), ("limit", "10".into())]).await else { continue; };
            let exact = found["artists"].as_array().into_iter().flatten().find(|artist| {
                artist["name"].as_str().is_some_and(|name| norm(name) == norm(&candidate)) ||
                artist["aliases"].as_array().is_some_and(|aliases| aliases.iter().any(|alias| alias["name"].as_str().is_some_and(|name| norm(name) == norm(&candidate))))
            });
            if let Some(artist) = exact {
                let name = artist["name"].as_str().unwrap_or_default();
                if excluded.contains(&norm(name)) || artist["aliases"].as_array().is_some_and(|aliases| aliases.iter().any(|alias| alias["name"].as_str().is_some_and(|name| excluded.contains(&norm(name))))) { continue; }
                if let Some(id) = artist["id"].as_str() {
                    if matching.iter().chain(other.iter()).any(|item: &Value| item["id"] == id) { continue; }
                    let aliases: Vec<&str> = artist["aliases"].as_array().into_iter().flatten()
                        .filter_map(|alias| alias["name"].as_str()).take(20).collect();
                    let verified = json!({"id": id, "name": name, "aliases": aliases, "country": artist["country"], "type": artist["type"], "lifeSpan": artist["life-span"], "languageMatch": language_match});
                    if language_match { matching.push(verified); } else { other.push(verified); }
                }
            }
        }
        if (matching.len() >= 5 && other.len() >= 15) || round == 4 { break; }
        let mut blocked = req.excluded_artists.clone();
        blocked.extend(seen.iter().cloned());
        let instance = INSTANCE.read().await;
        let ai = instance.ai.as_ref().context("请先在设置中配置 AI 音源").map_err(InvokeError::from_anyhow)?;
        match ai.recommend_daily_artists(&req.samples, &blocked, &req.language).await {
            Ok(more) => names = more,
            Err(error) => {
                log::warn!("daily artist refill stopped: {error}");
                break;
            }
        }
    }
    if matching.is_empty() && other.is_empty() {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("没有找到可核验的新歌手，请稍后重试")));
    }
    if matching.len() < 5 || other.len() < 15 {
        log::warn!("daily artists below target: matching={}, other={}", matching.len(), other.len());
    }
    let result = matching.into_iter().take(5).chain(other.into_iter().take(15)).collect();
    Ok(ApplicationResp::success_data(result))
}

#[tauri::command]
pub async fn daily_artist_images(artists: Vec<Value>) -> Result<ApplicationResp<Vec<Value>>, InvokeError> {
    if artists.len() > 20 { return Err(InvokeError::from_anyhow(anyhow::anyhow!("Too many artists"))); }
    let client = reqwest::Client::new();
    let mut images = Vec::new();
    for artist in artists {
        let (Some(id), Some(name)) = (artist["id"].as_str(), artist["name"].as_str()) else { continue; };
        if id.len() != 36 || name.len() > 150 { continue; }
        let result = client.get("https://www.theaudiodb.com/api/v1/json/123/search.php")
            .query(&[("s", name)]).timeout(Duration::from_secs(8)).send().await;
        let Ok(response) = result else { continue; };
        let Ok(data) = response.json::<Value>().await else { continue; };
        let found = data["artists"].as_array().into_iter().flatten().find(|item|
            item["strMusicBrainzID"].as_str() == Some(id) ||
            item["strArtist"].as_str().is_some_and(|value| norm(value) == norm(name)));
        if let Some(image) = found.and_then(|item| item["strArtistThumb"].as_str()) {
            images.push(json!({"id": id, "image": image}));
        }
    }
    Ok(ApplicationResp::success_data(images))
}

#[derive(Deserialize)]
pub struct ArtistDetailsReq { id: String, name: String, source: MusicSource, language: String }

async fn ai_artist_bio(name: &str, language: &str, facts: Value) -> String {
    let instance = INSTANCE.read().await;
    match instance.ai.as_ref() {
        Some(ai) => match ai.generate_artist_bio(name, &facts, language).await {
            Ok(bio) => bio,
            Err(error) => { log::warn!("AI artist biography failed: {error}"); String::new() }
        },
        None => String::new(),
    }
}

#[derive(Deserialize)]
pub struct ArtistBiographyReq { id: String, name: String, language: String }

#[tauri::command]
pub async fn daily_artist_biography(req: ArtistBiographyReq) -> Result<ApplicationResp<String>, InvokeError> {
    if req.id.len() != 36 || !req.id.chars().all(|ch| ch.is_ascii_hexdigit() || ch == '-') || req.name.len() > 150 {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid artist")));
    }
    let verified = mb(&format!("artist/{}", req.id), &[]).await.map_err(InvokeError::from_anyhow)?;
    let groups = mb("release-group/", &[("artist", req.id.clone()), ("limit", "10".into())]).await.map_err(InvokeError::from_anyhow)?;
    let facts = json!({"country": verified["country"], "type": verified["type"], "life_span": verified["life-span"],
        "albums": groups["release-groups"].as_array().into_iter().flatten().filter_map(|item| item["title"].as_str()).take(8).collect::<Vec<_>>()});
    let bio = ai_artist_bio(&req.name, &req.language, facts).await;
    Ok(ApplicationResp::success_data(bio))
}

async fn playable_track(source: &MusicSource, title: &str, artist: &str) -> Option<Value> {
    match source {
        MusicSource::Netesae => {
            let mut instance = INSTANCE.write().await;
            instance.netesae.client().search_song(title, artist).await.ok().flatten().and_then(|song| serde_json::to_value(song).ok())
        }
        MusicSource::QQ => crate::application::system::qqmusic::search_recommendation_song(title, artist).await.ok().flatten().and_then(|song| serde_json::to_value(song).ok()),
        MusicSource::Spotify => crate::application::system::spotify::search_recommendation_song(title, artist).await.ok().flatten(),
        _ => None,
    }
}

#[tauri::command]
pub async fn daily_artist_details(req: ArtistDetailsReq) -> Result<ApplicationResp<Value>, InvokeError> {
    if req.id.len() != 36 || !req.id.chars().all(|ch| ch.is_ascii_hexdigit() || ch == '-') || req.name.len() > 150 {
        return Err(InvokeError::from_anyhow(anyhow::anyhow!("Invalid artist")));
    }
    let groups = mb("release-group/", &[("artist", req.id.clone()), ("type", "album|ep|single".into()), ("limit", "25".into())]).await.map_err(InvokeError::from_anyhow)?;
    let recordings = mb("recording/", &[("artist", req.id.clone()), ("limit", "100".into())]).await.map_err(InvokeError::from_anyhow)?;
    let albums: Vec<Value> = groups["release-groups"].as_array().into_iter().flatten().take(12)
        .map(|group| json!({"title": group["title"], "date": group["first-release-date"], "type": group["primary-type"]})).collect();
    let info: Value = match reqwest::Client::new().get("https://www.theaudiodb.com/api/v1/json/123/search.php")
        .query(&[("s", req.name.as_str())]).timeout(Duration::from_secs(10)).send().await {
        Ok(response) => response.json().await.unwrap_or(Value::Null), Err(_) => Value::Null
    };
    let details = info["artists"].as_array().into_iter().flatten().find(|artist|
        artist["strMusicBrainzID"].as_str() == Some(req.id.as_str()) ||
        artist["strArtist"].as_str().is_some_and(|name| norm(name) == norm(&req.name)));
    let field = if req.language.starts_with("zh") { "strBiographyCN" } else { "strBiographyEN" };
    let bio = details.and_then(|artist| artist[field].as_str().filter(|text| !text.trim().is_empty())).unwrap_or_default();
    let mut bio = if bio.is_empty() && req.language.starts_with("zh") {
        let english = details.and_then(|artist| artist["strBiographyEN"].as_str()).unwrap_or_default();
        if english.is_empty() { String::new() } else {
            let instance = INSTANCE.read().await;
            match instance.ai.as_ref() {
                Some(ai) => ai.localize_artist_bio(&req.name, english, &req.language).await.unwrap_or_default(),
                None => String::new(),
            }
        }
    } else { bio.to_owned() };
    if bio.trim().is_empty() {
        let artist = mb(&format!("artist/{}", req.id), &[]).await.unwrap_or(Value::Null);
        let facts = json!({"country": artist["country"], "type": artist["type"], "life_span": artist["life-span"],
            "albums": albums.iter().filter_map(|album| album["title"].as_str()).take(8).collect::<Vec<_>>(),
            "recordings": recordings["recordings"].as_array().into_iter().flatten().filter_map(|item| item["title"].as_str()).take(8).collect::<Vec<_>>()});
        bio = ai_artist_bio(&req.name, &req.language, facts).await;
    }
    let image = details.and_then(|artist| artist["strArtistThumb"].as_str()).unwrap_or_default();
    let top: Value = match reqwest::Client::new().get("https://www.theaudiodb.com/api/v1/json/123/track-top10-mb.php")
        .query(&[("s", req.id.as_str())]).timeout(Duration::from_secs(10)).send().await {
        Ok(response) => response.json().await.unwrap_or(Value::Null), Err(_) => Value::Null
    };
    let candidates = top["track"].as_array().into_iter().flatten().filter_map(|song| song["strTrack"].as_str().map(str::to_owned))
        .chain(recordings["recordings"].as_array().into_iter().flatten().filter(|song|
            !song["disambiguation"].as_str().unwrap_or_default().to_lowercase().contains("live"))
            .filter_map(|song| song["title"].as_str().map(str::to_owned)));
    let mut titles = HashSet::new();
    let mut tracks = Vec::new();
    for title in candidates.take(30) {
        if tracks.len() >= 8 { break; }
        if title.len() > 100 || !titles.insert(norm(&title)) { continue; }
        if let Some(song) = playable_track(&req.source, &title, &req.name).await { tracks.push(song); }
    }
    if tracks.len() < 5 {
        let suggestions = {
            let instance = INSTANCE.read().await;
            match instance.ai.as_ref() {
                Some(ai) => ai.recommend_artist_tracks(&req.name, &titles.iter().cloned().collect::<Vec<_>>()).await.unwrap_or_default(),
                None => Vec::new(),
            }
        };
        for title in suggestions.into_iter().take(12) {
            if tracks.len() >= 8 { break; }
            if title.len() > 100 || !titles.insert(norm(&title)) { continue; }
            if let Some(song) = playable_track(&req.source, &title, &req.name).await { tracks.push(song); }
        }
    }
    Ok(ApplicationResp::success_data(json!({"albums": albums, "biography": bio, "bioChecked": true, "image": image, "tracks": tracks})))
}
