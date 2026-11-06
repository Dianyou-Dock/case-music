use crate::application::resp::ApplicationResp;
use crate::types::constants::MusicSource;
use crate::types::error::ErrorHandle;
use crate::types::error::MusicClientError::NotLogin;
use crate::types::song_url::{SongRate, SongUrl};
use crate::INSTANCE;
use ncm_api::Lyrics;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use std::collections::HashMap;
use tauri::ipc::InvokeError;
use tokio::sync::Mutex;

static RELEASE_DATES: Mutex<Option<HashMap<u64, Option<String>>>> = Mutex::const_new(None);

#[tauri::command]
pub async fn song_release_date(album_id: u64) -> Result<ApplicationResp<Option<String>>, InvokeError> {
    let mut cache = RELEASE_DATES.lock().await;
    let dates = cache.get_or_insert_with(HashMap::new);
    if let Some(date) = dates.get(&album_id) {
        return Ok(ApplicationResp::success_data(date.clone()));
    }
    let date = INSTANCE.write().await.netesae.client().album_release_date(album_id).await.ok().flatten().map(|(_, date)| date);
    dates.insert(album_id, date.clone());
    Ok(ApplicationResp::success_data(date))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SongsUrlReq {
    pub source: MusicSource,
    pub songs: Vec<u64>,
    pub rate: SongRate,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SongLyricsReq {
    pub source: MusicSource,
    pub song_id: u64,
}

#[tauri::command]
pub async fn song_lyrics(req: SongLyricsReq) -> Result<ApplicationResp<Lyrics>, InvokeError> {
    let mut instance = INSTANCE.write().await;
    let lyrics = match req.source {
        MusicSource::Netesae => instance.netesae.client().song_lyrics(req.song_id).await,
        _ => {
            return Ok(ApplicationResp::success_data(Lyrics {
                lyric: vec![],
                tlyric: vec![],
            }))
        }
    };
    match lyrics {
        Ok(lyrics) => Ok(ApplicationResp::success_data(lyrics)),
        Err(error) => {
            log::warn!("Could not load lyrics for song {}: {error:#}", req.song_id);
            Ok(ApplicationResp::success_data(Lyrics {
                lyric: vec![],
                tlyric: vec![],
            }))
        }
    }
}

#[cfg(test)]
mod lyric_tests {
    #[test]
    fn missing_translation_does_not_hide_original_lyrics() {
        let response = r#"{"code":200,"lrc":{"lyric":"[00:01.00]First line\n[00:02.00]Second line"}}"#;
        let lyrics = ncm_api::to_lyric(response.to_string()).unwrap();
        assert_eq!(lyrics.lyric.len(), 2);
        assert!(lyrics.tlyric.is_empty());
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct SongsUrlResp<T: Serialize + Clone + Debug> {
    pub urls: Vec<T>,
    pub likeds: Vec<bool>,
}

#[tauri::command]
pub async fn songs_url(
    req: SongsUrlReq,
) -> Result<ApplicationResp<SongsUrlResp<SongUrl>>, InvokeError> {
    let Some(likeds) = INSTANCE.read().await.netesae.likeds() else {
        return Err(InvokeError::from_anyhow(NotLogin.anyhow_err()));
    };

    let mut instance = INSTANCE.write().await;

    let (list, ls) = match req.source {
        MusicSource::Netesae => {
            let result = instance
                .netesae
                .client()
                .songs_url(&req.songs, req.rate)
                .await
                .map_err(InvokeError::from_anyhow)?;

            let mut ls = vec![];
            for id in &req.songs {
                if likeds.contains(id) {
                    ls.push(true);
                } else {
                    ls.push(false);
                }
            }
            (result, ls)
        }
        MusicSource::Spotify => {
            todo!()
        }
        MusicSource::QQ => {
            todo!()
        }
        MusicSource::Apple => {
            todo!()
        }
    };

    Ok(ApplicationResp::success_data(SongsUrlResp {
        urls: list,
        likeds: ls,
    }))
}
