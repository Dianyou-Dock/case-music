use crate::ai_client::Client;
use crate::types::ai_recommend_info::{
    AiRecommendInfo, AiRecommendSingerInfo, AiRecommendSongInfo,
};
use crate::types::apikey::AiApiKey;
use crate::types::constants::{
    data_path, gen_ai_singer_prompt, gen_rand_recommend_content, gen_recommend_singer_content,
    gen_random_recommend_prompt, gen_recommend_song_content, gen_recommend_style_content, gen_single_song_prompt,
    gen_single_song_review_content, AiSource, APIKEY_DIR, APIKEY_FILE, CURSOR_AGENTS_URL,
    DEEPSEEK_URL, KIMI_URL, OPENAI_URL,
};
use anyhow::Result;
use async_trait::async_trait;
use err_logging::ctx;
use err_logging::error_logging::ErrorLogging;
use reqwest::header::CONTENT_TYPE;
use reqwest::{Method, Request};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::time::Duration;
use tokio::fs;
use tokio::time::sleep;

#[derive(Serialize, Deserialize, Debug)]
struct Message {
    role: String,
    content: String,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    response_format: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Deserialize, Debug)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize, Debug)]
struct ResponseMessage {
    content: Option<String>,
}

#[derive(Deserialize, Debug)]
struct ChatResp {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct SongReviewResult {
    reviews: Vec<SongReview>,
}

#[derive(Deserialize)]
struct SongReview {
    index: usize,
    close_match: bool,
    score: u8,
}

fn keep_close_matches(
    candidates: Vec<AiRecommendSongInfo>,
    reviews: SongReviewResult,
    count: u64,
) -> Vec<AiRecommendSongInfo> {
    let fallback = candidates.clone();
    let accepted: BTreeMap<usize, u8> = reviews
        .reviews
        .into_iter()
        .filter(|review| review.close_match && review.score >= 80)
        .map(|review| (review.index, review.score))
        .collect();

    let mut ranked: Vec<_> = candidates
        .into_iter()
        .enumerate()
        .filter_map(|(index, song)| accepted.get(&index).map(|score| (*score, index, song)))
        .collect();
    ranked.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    let mut artist_counts = HashMap::<String, usize>::new();
    let selected: Vec<_> = ranked
        .into_iter()
        .map(|(_, _, song)| song)
        .filter(|song| {
            let seen = artist_counts.entry(song.singer.trim().to_lowercase()).or_default();
            if *seen >= 2 { return false; }
            *seen += 1;
            true
        })
        .take(count as usize)
        .collect();
    if selected.is_empty() {
        fallback.into_iter().take(count as usize).collect()
    } else {
        selected
    }
}

fn fill_reviewed_matches(
    candidates: Vec<AiRecommendSongInfo>,
    reviews: SongReviewResult,
    count: u64,
) -> Vec<AiRecommendSongInfo> {
    let scores: BTreeMap<usize, (bool, u8)> = reviews.reviews.into_iter()
        .map(|review| (review.index, (review.close_match, review.score))).collect();
    let mut ranked: Vec<_> = candidates.into_iter().enumerate().collect();
    ranked.sort_by_key(|(index, _)| {
        let (close, score) = scores.get(index).copied().unwrap_or((false, 0));
        (std::cmp::Reverse(close && score >= 80), std::cmp::Reverse(score), *index)
    });
    let mut artist_counts = HashMap::<String, usize>::new();
    ranked.into_iter().map(|(_, song)| song).filter(|song| {
        let seen = artist_counts.entry(song.singer.trim().to_lowercase()).or_default();
        if *seen >= 2 { return false; }
        *seen += 1;
        true
    }).take(count as usize).collect()
}

#[allow(dead_code)]
pub struct ChatClient {
    client: reqwest::Client,
    apikey: AiApiKey,
    apikey_path: Option<PathBuf>,
    source: AiSource,
}

pub type Kimi = ChatClient;

impl ChatClient {
    pub async fn new(api_key: String) -> Result<Self> {
        Self::new_for(AiSource::Kimi, api_key).await
    }

    pub async fn new_for(source: AiSource, api_key: String) -> Result<Self> {
        let client = reqwest::Client::new();
        let apikey_dir = data_path().join(APIKEY_DIR).join(source.to_string());
        let apikey_file = apikey_dir.join(APIKEY_FILE);

        if !apikey_dir.exists() {
            fs::create_dir_all(&apikey_dir).await?;
        }

        let apikey = AiApiKey { key: api_key };
        let json = serde_json::to_string_pretty(&apikey)?;
        fs::write(&apikey_file, &json).await?;

        Ok(Self {
            client,
            apikey,
            apikey_path: Some(apikey_file),
            source,
        })
    }

    pub fn gen_req(&self, content: &str, prompt: &str) -> Result<Request> {
        self.gen_req_with_temperature(content, prompt, 1.0)
    }

    fn gen_req_with_temperature(
        &self,
        content: &str,
        prompt: &str,
        temperature: f64,
    ) -> Result<Request> {
        if self.source == AiSource::Cursor {
            return Ok(self.client.post(CURSOR_AGENTS_URL)
                .bearer_auth(self.apikey.key.as_str())
                .json(&json!({
                    "name": "Case Music recommendation",
                    "prompt": { "text": format!("{prompt}\n\n{content}\n\nReturn only the requested JSON object, without Markdown or commentary.") }
                }))
                .build()?);
        }
        let chat_req = ChatRequest {
            model: match self.source {
                AiSource::Kimi => "moonshot-v1-128k",
                AiSource::DeepSeek => "deepseek-flash",
                AiSource::ChatGPT => "gpt-6-luna",
                AiSource::Cursor => unreachable!(),
            }
            .to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: if self.source == AiSource::DeepSeek {
                        format!("{prompt}\nReturn only a valid JSON object.")
                    } else {
                        prompt.to_string()
                    },
                },
                Message {
                    role: "user".to_string(),
                    content: content.to_string(),
                },
            ],
            response_format: json!({"type": "json_object"}),
            temperature: (self.source != AiSource::ChatGPT).then_some(temperature),
            reasoning_effort: (self.source == AiSource::ChatGPT).then(|| "none".to_string()),
            thinking: (self.source == AiSource::DeepSeek).then(|| json!({"type": "disabled"})),
            max_tokens: (self.source == AiSource::DeepSeek).then_some(8192),
        };

        let url = match self.source {
            AiSource::Kimi => KIMI_URL,
            AiSource::DeepSeek => DEEPSEEK_URL,
            AiSource::ChatGPT => OPENAI_URL,
            AiSource::Cursor => unreachable!(),
        };
        let req = self.client.request(Method::POST, url);

        let req = req
            .header(CONTENT_TYPE, "application/json")
            .bearer_auth(self.apikey.key.as_str())
            .json(&chat_req)
            .build()?;

        Ok(req)
    }

    pub(crate) fn load_for(source: AiSource) -> Result<Option<Self>> {
        let apikey_dir = data_path().join(APIKEY_DIR).join(source.to_string());
        let apikey_file = apikey_dir.join(APIKEY_FILE);

        if !apikey_file.exists() {
            return Ok(None);
        }

        let key_str = std::fs::read_to_string(&apikey_file)?;
        let apikey = serde_json::from_str::<AiApiKey>(&key_str)?;
        let kimi = Self {
            client: reqwest::Client::new(),
            apikey,
            apikey_path: Some(apikey_file),
            source,
        };

        Ok(Some(kimi))
    }

    pub async fn send<T: DeserializeOwned>(&self, req: Request) -> Result<T> {
        if self.source == AiSource::Cursor {
            return self.send_cursor(req).await;
        }
        let resp = self.client.execute(req).await.elog(ctx!())?;

        if !resp.status().is_success() {
            let code = resp.status();
            let bytes = resp.bytes().await.elog(ctx!())?;
            let msg = String::from_utf8(bytes.to_vec()).elog(ctx!())?;
            return Err(anyhow::anyhow!(
                "{} server responded with code: {}, error: {}",
                self.source,
                code,
                msg
            ));
        }

        let chat_resp = resp.json::<ChatResp>().await.elog(ctx!())?;
        let data = if let Some(data) = chat_resp.choices.first() {
            let content = data
                .message
                .content
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| anyhow::anyhow!("{} response has no content", self.source))?;
            let data = serde_json::from_str::<T>(content).elog(ctx!())?;
            data
        } else {
            return Err(anyhow::anyhow!("{} response has no content", self.source));
        };

        Ok(data)
    }

    async fn send_cursor<T: DeserializeOwned>(&self, req: Request) -> Result<T> {
        let create = self.client.execute(req).await?;
        let status = create.status();
        if !status.is_success() {
            anyhow::bail!("Cursor returned {status}: {}", create.text().await?);
        }
        let created: Value = create.json().await?;
        let agent_id = created["agent"]["id"].as_str()
            .ok_or_else(|| anyhow::anyhow!("Cursor did not return an agent ID"))?;
        let run_id = created["run"]["id"].as_str()
            .ok_or_else(|| anyhow::anyhow!("Cursor did not return a run ID"))?;
        let url = format!("{CURSOR_AGENTS_URL}/{agent_id}/runs/{run_id}");
        let result = tokio::time::timeout(Duration::from_secs(240), async {
            loop {
                sleep(Duration::from_secs(3)).await;
                let response = self.client.get(&url).bearer_auth(self.apikey.key.as_str()).send().await?;
                let status = response.status();
                if !status.is_success() {
                    anyhow::bail!("Cursor run returned {status}: {}", response.text().await?);
                }
                let run: Value = response.json().await?;
                match run["status"].as_str().unwrap_or_default() {
                    "FINISHED" => {
                        let text = run["result"].as_str()
                            .ok_or_else(|| anyhow::anyhow!("Cursor run has no result"))?;
                        return parse_cursor_json(text);
                    }
                    "ERROR" | "CANCELLED" | "EXPIRED" => anyhow::bail!("Cursor run ended: {}", run["status"]),
                    _ => {}
                }
            }
        }).await.map_err(|_| anyhow::anyhow!("Cursor run timed out after 4 minutes"))?;
        let archive_url = format!("{CURSOR_AGENTS_URL}/{agent_id}/archive");
        let _ = tokio::time::timeout(Duration::from_secs(5), self.client.post(archive_url)
            .bearer_auth(self.apikey.key.as_str()).send()).await;
        result
    }
}

fn parse_cursor_json<T: DeserializeOwned>(text: &str) -> Result<T> {
    let trimmed = text.trim();
    if let Ok(parsed) = serde_json::from_str(trimmed) { return Ok(parsed); }
    let start = trimmed.find('{').ok_or_else(|| anyhow::anyhow!("Cursor did not return JSON"))?;
    let end = trimmed.rfind('}').ok_or_else(|| anyhow::anyhow!("Cursor did not return JSON"))?;
    Ok(serde_json::from_str(&trimmed[start..=end])?)
}

#[async_trait]
impl Client for ChatClient {
    async fn recommend_artist_tracks(&self, artist: &str, excluded: &[String]) -> Result<Vec<String>> {
        let content = json!({"artist": artist, "excluded_titles": excluded, "count": 18}).to_string();
        let prompt = "Name 18 real, released, searchable songs performed by the specified artist. Prefer their well-known studio recordings. Exclude the listed titles and avoid live versions, remixes and duplicates. Do not invent songs or include songs by similarly named artists. Return only JSON: {\"tracks\":[\"Exact song title\",...]}";
        let request = self.gen_req_with_temperature(&content, prompt, 0.1)?;
        let result: Value = self.send(request).await?;
        Ok(result["tracks"].as_array().into_iter().flatten().filter_map(|item| item.as_str().map(str::to_owned)).collect())
    }
    async fn localize_artist_bio(&self, artist: &str, biography: &str, language: &str) -> Result<String> {
        let content = json!({"artist": artist, "source_biography": biography, "language": language}).to_string();
        let prompt = "Summarize and translate the provided artist biography into the requested language in at most 120 words. Use only facts present in the provided biography. Do not invent details. Return only JSON: {\"biography\":\"...\"}.";
        let request = self.gen_req_with_temperature(&content, prompt, 0.1)?;
        let result: Value = self.send(request).await?;
        Ok(result["biography"].as_str().unwrap_or_default().to_owned())
    }
    async fn generate_artist_bio(&self, artist: &str, facts: &Value, language: &str) -> Result<String> {
        let content = json!({"artist": artist, "verified_facts": facts, "language": language}).to_string();
        let prompt = "Write a concise, natural artist introduction in the requested language, at most 120 words. Use only the supplied verified MusicBrainz facts: country, artist type, active dates, album titles and recording titles. Do not invent a genre, career story, awards, influences, or personal details. If the facts are sparse, write a shorter introduction using only what is known. Return only JSON: {\"biography\":\"...\"}.";
        let request = self.gen_req_with_temperature(&content, prompt, 0.1)?;
        let result: Value = self.send(request).await?;
        Ok(result["biography"].as_str().unwrap_or_default().trim().to_owned())
    }
    async fn recommend_daily_artists(&self, samples: &[Value], excluded: &[String], language: &str) -> Result<Vec<Value>> {
        let content = json!({"samples": samples, "excluded_artists": excluded, "target_count": 36, "language": language, "target_language_candidates": 10, "other_language_candidates": 26}).to_string();
        let prompt = "You are a music discovery editor. Analyze the sample songs' style, mood and era. Recommend 36 real, searchable artists with similar appeal and variety. About 10 must predominantly perform vocal songs in the requested language (zh=Chinese, en=English). At least 26 must predominantly perform in OTHER languages, not the requested language. Mark language_match true only for the first group, based on the language of their songs, not nationality or name. Exclude every sample artist and excluded artist, including aliases and collaborations. Return only JSON: {\"artists\":[{\"name\":\"Artist name\",\"language_match\":true}]}. Keep names in their recognized form. Do not invent artists.";
        let request = self.gen_req_with_temperature(&content, prompt, 0.45)?;
        let response: Value = self.send(request).await?;
        Ok(response["artists"].as_array().cloned().unwrap_or_default())
    }
    async fn daily_music_notes(&self, songs: &[Value]) -> Result<Vec<Value>> {
        let prompt = "你是音乐编辑。根据提供的歌曲元数据，为每首歌写简短、具体、自然的中文音乐导读。不要编造创作背景、歌词内容或未经证实的事实。只输出 JSON 对象，格式为 {\"notes\":[{\"id\":\"歌曲id\",\"summary\":\"不超过60字的导读\",\"mood\":\"不超过8字的氛围\"}]}。每首歌必须有一条，顺序与输入一致。";
        let req = self.gen_req_with_temperature(&serde_json::to_string(songs)?, prompt, 0.5)?;
        let result: Value = self.send(req).await?;
        Ok(result["notes"].as_array().cloned().unwrap_or_default())
    }
    async fn recommend_song(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
        previous: Option<Vec<AiRecommendSongInfo>>,
    ) -> Result<AiRecommendInfo> {
        let pre = if let Some(pre) = previous {
            Some(serde_json::to_string(&pre)?)
        } else {
            None
        };

        let candidate_count = count.saturating_mul(2).min(30);
        let content = gen_recommend_song_content(&data.name, &data.singer, candidate_count, pre);
        let prompt = gen_single_song_prompt();

        let req = self.gen_req_with_temperature(&content, &prompt, 0.2)?;

        let mut resp: AiRecommendInfo = self.send(req).await?;
        if resp.recommends.is_empty() {
            let retry = format!("{content} The previous attempt returned no songs. Give real, well-known, searchable recordings now; broaden the style if needed. Return at least one recommendation in the required JSON shape.");
            let retry_req = self.gen_req_with_temperature(&retry, &prompt, 0.4)?;
            resp = self.send(retry_req).await?;
        }
        if resp.recommends.is_empty() {
            return Ok(resp);
        }

        let candidates = serde_json::to_string(&resp.recommends)?;
        let review_content =
            gen_single_song_review_content(&data.name, &data.singer, &candidates);
        let review_prompt =
            "You independently audit music similarity. Be conservative. Return only JSON.";
        let review_req = self.gen_req_with_temperature(&review_content, review_prompt, 0.0)?;
        let reviews: SongReviewResult = self.send(review_req).await?;
        resp.recommends = keep_close_matches(resp.recommends, reviews, candidate_count);

        Ok(resp)
    }

    async fn rand_recommends(
        &self,
        data: &[AiRecommendSongInfo],
        count: u64,
        previous: &[AiRecommendSongInfo],
    ) -> Result<AiRecommendInfo> {
        let sample_playlist = serde_json::to_string_pretty(data).elog(ctx!())?;

        let candidate_count = count.saturating_mul(2).min(30);
        let mut content = gen_rand_recommend_content(&sample_playlist, candidate_count);
        if !previous.is_empty() {
            content.push_str(&format!(" Exclude these recently recommended exact recordings (title and artist): {}.", serde_json::to_string(previous)?));
        }
        let prompt = gen_random_recommend_prompt();

        let req = self.gen_req_with_temperature(&content, &prompt, 0.2).elog(ctx!())?;

        let mut resp: AiRecommendInfo = self.send(req).await.elog(ctx!())?;
        if resp.recommends.is_empty() {
            content.push_str(" The previous attempt returned no songs. Give real, well-known, searchable recordings now; broaden the style if needed. Return at least one recommendation in the required JSON shape.");
            let retry_req = self.gen_req_with_temperature(&content, &prompt, 0.4)?;
            resp = self.send(retry_req).await.elog(ctx!())?;
        }
        if resp.recommends.len() < count as usize {
            let existing = serde_json::to_string(&resp.recommends)?;
            let extra_content = format!("{content} Only {} candidates were supplied. Suggest {} additional real, searchable recordings close to the same taste. Do not repeat these recordings: {existing}. Return the required JSON shape.",
                resp.recommends.len(), candidate_count.saturating_sub(resp.recommends.len() as u64));
            let extra_req = self.gen_req_with_temperature(&extra_content, &prompt, 0.4)?;
            if let Ok(extra) = self.send::<AiRecommendInfo>(extra_req).await {
                let mut seen: std::collections::HashSet<_> = resp.recommends.iter()
                    .map(|song| (song.name.trim().to_lowercase(), song.singer.trim().to_lowercase())).collect();
                for song in extra.recommends {
                    if seen.insert((song.name.trim().to_lowercase(), song.singer.trim().to_lowercase())) {
                        resp.recommends.push(song);
                    }
                    if resp.recommends.len() >= candidate_count as usize { break; }
                }
            }
        }
        if !resp.recommends.is_empty() {
            let candidates = serde_json::to_string(&resp.recommends)?;
            let review = format!(
                "User liked-song samples: {sample_playlist}. Independently identify the closest audible style, using a single sample when necessary. Do not use the proposed benchmark or candidate style labels as evidence. Prefer candidates sharing specific style and known traits among groove, tempo, vocals, instruments and production. With sparse samples, allow adjacent styles rather than rejecting every song. Reject invented recordings. Candidates: {candidates}. Return JSON only: {{\"reviews\":[{{\"index\":0,\"close_match\":true,\"score\":90}}]}}. Include every candidate with zero-based index. Set close_match=true and score 80-89 for a clear match, 90-100 only for a very close match; otherwise close_match=false and score below 80.",
            );
            let review_req = self.gen_req_with_temperature(&review, "You are a strict music taste reviewer. Return valid JSON only.", 0.0)?;
            let reviews: SongReviewResult = self.send(review_req).await?;
            resp.recommends = fill_reviewed_matches(resp.recommends, reviews, candidate_count);
        }
        Ok(resp)
    }

    async fn fill_decades(
        &self,
        data: &[AiRecommendSongInfo],
        decades: &[i32],
    ) -> Result<AiRecommendInfo> {
        let samples = serde_json::to_string(data)?;
        let content = format!(
            "Liked-song samples: {samples}. The recommendation list could optionally include recordings from these release decades or exact years: {decades:?}. First identify a coherent audible style in the samples. Suggest a recording from a requested period ONLY when its specific style and at least two known musical traits closely match; it is acceptable to leave periods unfilled. Do not invent unfamiliar recordings or treat a recent cover, remix or reissue as an older recording. Accuracy takes priority over era coverage. Include the exact song name, artist and actual musical style. Return JSON only in this shape: {template}",
            template = crate::types::constants::AI_SONG_RESP_TEMPLATE,
        );
        let req = self.gen_req_with_temperature(&content, "You curate accurate music recommendations across release decades. Return valid JSON only.", 0.4)?;
        let mut resp: AiRecommendInfo = self.send(req).await?;
        if !resp.recommends.is_empty() {
            let candidates = serde_json::to_string(&resp.recommends)?;
            let review = format!(
                "Liked-song samples: {samples}. Independently identify a coherent audible style in the samples. Verify that every candidate is a real recording originally released in one of the requested decades or exact years {decades:?}, with compatible specific style and at least two shared known musical traits. Reject uncertain identities, genre-adjacent songs, remasters and recent covers. It is acceptable to reject every candidate. Candidates: {candidates}. Return JSON only: {{\"reviews\":[{{\"index\":0,\"close_match\":true,\"score\":90}}]}}. Include every candidate with a zero-based index; accept only strong matches with score >=80."
            );
            let review_req = self.gen_req_with_temperature(&review, "You are a strict music genre and release-date reviewer. Return valid JSON only.", 0.0)?;
            let reviews: SongReviewResult = self.send(review_req).await?;
            let count = resp.recommends.len() as u64;
            resp.recommends = keep_close_matches(resp.recommends, reviews, count);
        }
        Ok(resp)
    }

    async fn recommend_style(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
        previous: Option<Vec<AiRecommendSongInfo>>,
    ) -> Result<AiRecommendInfo> {
        let pre = if let Some(pre) = previous {
            Some(serde_json::to_string(&pre)?)
        } else {
            None
        };

        let content = gen_recommend_style_content(&data.name, count, pre);
        let prompt = gen_ai_singer_prompt();

        let req = self.gen_req(&content, &prompt)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }

    async fn recommend_singer(
        &self,
        data: AiRecommendSongInfo,
        singer_count: u64,
        song_count: u64,
        previous: Option<Vec<String>>,
    ) -> Result<AiRecommendSingerInfo> {
        let pre = if let Some(pre) = previous {
            Some(serde_json::to_string(&pre)?)
        } else {
            None
        };

        let content = gen_recommend_singer_content(&data.singer, song_count, singer_count, pre);
        let prompt = gen_ai_singer_prompt();

        let req = self.gen_req(&content, &prompt)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }

    fn ai_source(&self) -> AiSource {
        self.source
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::env;

    #[test]
    fn chatgpt_uses_openai_chat_endpoint_and_json_mode() {
        let client = ChatClient {
            client: reqwest::Client::new(),
            apikey: AiApiKey { key: "test-key".into() },
            apikey_path: None,
            source: AiSource::ChatGPT,
        };
        let request = client.gen_req_with_temperature("songs", "Return JSON", 0.2).unwrap();
        assert_eq!(request.url().as_str(), OPENAI_URL);
        let body: Value = serde_json::from_slice(request.body().unwrap().as_bytes().unwrap()).unwrap();
        assert_eq!(body["model"], "gpt-6-luna");
        assert_eq!(body["reasoning_effort"], "none");
        assert_eq!(body["response_format"]["type"], "json_object");
        assert!(body.get("temperature").is_none());
    }

    #[test]
    fn cursor_uses_no_repo_agent_and_parses_json_reply() {
        let client = ChatClient {
            client: reqwest::Client::new(),
            apikey: AiApiKey { key: "test-key".into() },
            apikey_path: None,
            source: AiSource::Cursor,
        };
        let request = client.gen_req("songs", "Return JSON").unwrap();
        assert_eq!(request.url().as_str(), CURSOR_AGENTS_URL);
        let body: Value = serde_json::from_slice(request.body().unwrap().as_bytes().unwrap()).unwrap();
        assert!(body.get("repos").is_none());
        assert!(body["prompt"]["text"].as_str().unwrap().contains("Return JSON"));
        let parsed: Value = parse_cursor_json("```json\n{\"recommends\":[]}\n```").unwrap();
        assert_eq!(parsed["recommends"], json!([]));
    }

    #[test]
    fn similarity_audit_rejects_weak_songs_without_padding() {
        let candidates: Vec<_> = ["close", "weak", "unreviewed", "also close"]
            .into_iter()
            .map(|name| AiRecommendSongInfo {
                name: name.to_string(),
                singer: "artist".to_string(),
                song_type: "R&B".to_string(),
            })
            .collect();
        let reviews = SongReviewResult {
            reviews: vec![
                SongReview {
                    index: 3,
                    close_match: true,
                    score: 90,
                },
                SongReview {
                    index: 1,
                    close_match: true,
                    score: 79,
                },
                SongReview {
                    index: 0,
                    close_match: true,
                    score: 84,
                },
                SongReview {
                    index: 100,
                    close_match: true,
                    score: 99,
                },
            ],
        };
        let filtered = keep_close_matches(candidates, reviews, 15);
        assert_eq!(
            filtered
                .iter()
                .map(|song| song.name.as_str())
                .collect::<Vec<_>>(),
            vec!["also close", "close"]
        );
    }

    #[test]
    fn similarity_audit_limits_each_artist_to_two_songs() {
        let candidates: Vec<_> = ["A", "a", " A ", "B"]
            .into_iter()
            .enumerate()
            .map(|(index, singer)| AiRecommendSongInfo {
                name: format!("song {index}"),
                singer: singer.to_string(),
                song_type: "pop".to_string(),
            })
            .collect();
        let reviews = SongReviewResult {
            reviews: (0..4).map(|index| SongReview { index, close_match: true, score: 90 }).collect(),
        };
        let filtered = keep_close_matches(candidates, reviews, 4);
        assert_eq!(filtered.iter().map(|song| song.name.as_str()).collect::<Vec<_>>(), vec!["song 0", "song 1", "song 3"]);
    }

    #[test]
    fn similarity_audit_keeps_candidates_when_review_rejects_all() {
        let candidates = vec![AiRecommendSongInfo {
            name: "Known song".into(), singer: "Known artist".into(), song_type: "Pop".into(),
        }];
        let reviews = SongReviewResult { reviews: vec![SongReview { index: 0, close_match: false, score: 60 }] };
        assert_eq!(keep_close_matches(candidates, reviews, 1).len(), 1);
    }

    #[test]
    fn random_recommendations_fill_after_strict_matches() {
        let candidates = vec![
            AiRecommendSongInfo { name: "close".into(), singer: "artist one".into(), song_type: "R&B".into() },
            AiRecommendSongInfo { name: "adjacent".into(), singer: "artist two".into(), song_type: "Pop".into() },
        ];
        let reviews = SongReviewResult { reviews: vec![
            SongReview { index: 0, close_match: true, score: 90 },
            SongReview { index: 1, close_match: false, score: 65 },
        ] };
        let result = fill_reviewed_matches(candidates, reviews, 15);
        assert_eq!(result.iter().map(|song| song.name.as_str()).collect::<Vec<_>>(), vec!["close", "adjacent"]);
    }

    #[test]
    fn deepseek_request_uses_json_mode() {
        let ai_client = ChatClient {
            client: reqwest::Client::new(),
            apikey: AiApiKey {
                key: "test-key".to_string(),
            },
            apikey_path: None,
            source: AiSource::DeepSeek,
        };
        let request = ai_client
            .gen_req("recommend a song", "music assistant")
            .unwrap();
        assert_eq!(request.url().as_str(), DEEPSEEK_URL);
        let body: Value =
            serde_json::from_slice(request.body().unwrap().as_bytes().unwrap()).unwrap();
        assert_eq!(body["model"], "deepseek-flash");
        assert_eq!(body["thinking"]["type"], "disabled");
        assert_eq!(body["response_format"]["type"], "json_object");
        assert!(body["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("JSON"));
    }

    fn runtime() -> tokio::runtime::Runtime {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt
    }

    #[test]
    fn test_recommend_song() {
        runtime().block_on(async {
            let song = "I Stay In Love";
            let singer = "Mariah Carey";
            let api_key = env::var("API_KEY").unwrap();

            let ai_client = Kimi::new(api_key.to_string()).await.unwrap();

            // round1
            let result = ai_client
                .recommend_song(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                        song_type: String::new(),
                    },
                    10,
                    None,
                )
                .await
                .unwrap();

            println!("round1: {:?}", result);

            // round2
            let result = ai_client
                .recommend_song(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                        song_type: String::new(),
                    },
                    10,
                    Some(result.recommends),
                )
                .await
                .unwrap();

            println!("round2: {:?}", result);
        });
    }

    #[test]
    fn test_recommend_style() {
        runtime().block_on(async {
            let song = "孤独患者";
            let singer = "陈奕迅";
            let api_key = env::var("API_KEY").unwrap();

            let ai_client = Kimi::new(api_key.to_string()).await.unwrap();

            // round1
            let result = ai_client
                .recommend_style(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                        song_type: String::new(),
                    },
                    3,
                    None,
                )
                .await
                .unwrap();

            println!("round1: {:?}", result);

            // round2
            let result = ai_client
                .recommend_style(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                        song_type: String::new(),
                    },
                    3,
                    Some(result.recommends),
                )
                .await
                .unwrap();

            println!("round2: {:?}", result);
        });
    }

    #[test]
    fn test_recommend_singer() {
        runtime().block_on(async {
            let song = "Luv(sic.) part 3";
            let singer = "Nujabes";
            let api_key = env::var("API_KEY").unwrap();

            let ai_client = Kimi::new(api_key.to_string()).await.unwrap();

            // round1
            let result = ai_client
                .recommend_singer(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                        song_type: String::new(),
                    },
                    2,
                    3,
                    None,
                )
                .await
                .unwrap();

            println!("round1: {:?}", result);

            // round2
            let pre = result.recommends.iter().map(|(k, _v)| k.clone()).collect();
            let result = ai_client
                .recommend_singer(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                        song_type: String::new(),
                    },
                    2,
                    3,
                    Some(pre),
                )
                .await
                .unwrap();

            println!("round2: {:?}", result);
        });
    }

    #[test]
    fn test_daily_recommend() {
        runtime().block_on(async {
            let song1 = "Luv(sic.) part 3";
            let singer1 = "Nujabes";

            let song2 = "孤独患者";
            let singer2 = "陈奕迅";

            let song3 = "I Stay In Love";
            let singer3 = "Mariah Carey";

            let sample_playlist = vec![
                AiRecommendSongInfo {
                    name: song1.to_string(),
                    singer: singer1.to_string(),
                    song_type: String::new(),
                },
                AiRecommendSongInfo {
                    name: song2.to_string(),
                    singer: singer2.to_string(),
                    song_type: String::new(),
                },
                AiRecommendSongInfo {
                    name: song3.to_string(),
                    singer: singer3.to_string(),
                    song_type: String::new(),
                },
            ];

            let api_key = env::var("API_KEY").unwrap();
            let ai_client = Kimi::new(api_key.to_string()).await.unwrap();

            let result = ai_client
                .rand_recommends(&sample_playlist, 15, &[])
                .await
                .unwrap();

            println!("result len: {}", result.recommends.len());
            println!("result: {}", serde_json::to_string_pretty(&result).unwrap());
        });
    }
}
