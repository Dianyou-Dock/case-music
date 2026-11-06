use crate::ai_client::Client;
use crate::types::ai_recommend_info::{
    AiRecommendInfo, AiRecommendSingerInfo, AiRecommendSongInfo,
};
use crate::types::apikey::AiApiKey;
use crate::types::constants::{
    data_path, gen_ai_singer_prompt, gen_rand_recommend_content, gen_recommend_singer_content,
    gen_recommend_song_content, gen_recommend_style_content, gen_single_song_prompt,
    gen_single_song_review_content, AiSource, APIKEY_DIR, APIKEY_FILE, DEEPSEEK_URL, KIMI_URL,
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
use tokio::fs;

#[derive(Serialize, Deserialize, Debug)]
struct Message {
    role: String,
    content: String,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f64,
    response_format: Value,
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
    ranked
        .into_iter()
        .map(|(_, _, song)| song)
        .filter(|song| {
            let seen = artist_counts.entry(song.singer.trim().to_lowercase()).or_default();
            if *seen >= 2 { return false; }
            *seen += 1;
            true
        })
        .take(count as usize)
        .collect()
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
        let chat_req = ChatRequest {
            model: match self.source {
                AiSource::Kimi => "moonshot-v1-128k",
                AiSource::DeepSeek => "deepseek-flash",
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
            temperature,
            thinking: (self.source == AiSource::DeepSeek).then(|| json!({"type": "disabled"})),
            max_tokens: (self.source == AiSource::DeepSeek).then_some(8192),
        };

        let url = match self.source {
            AiSource::Kimi => KIMI_URL,
            AiSource::DeepSeek => DEEPSEEK_URL,
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
}

#[async_trait]
impl Client for ChatClient {
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
            return Ok(resp);
        }

        let benchmark = serde_json::to_string(&resp.benchmark)?;
        let candidates = serde_json::to_string(&resp.recommends)?;
        let review_content =
            gen_single_song_review_content(&data.name, &data.singer, &benchmark, &candidates);
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
        let prompt = gen_ai_singer_prompt();

        println!("content: {content}");

        let req = self.gen_req_with_temperature(&content, &prompt, 0.5).elog(ctx!())?;

        let mut resp: AiRecommendInfo = self.send(req).await.elog(ctx!())?;
        if !resp.recommends.is_empty() {
            let candidates = serde_json::to_string(&resp.recommends)?;
            let review = format!(
                "User liked-song samples: {sample_playlist}. The proposed dominant primary genre is {genre}. Independently review each actual recording. Reject anything outside that primary genre, including generic adjacency and crossovers dominated by another genre. Within the same primary genre, accept different subgenres, old and new recordings, and unfamiliar artists if they fit the listener's preferences. Reject uncertain identities. Candidates: {candidates}. Return JSON only: {{\"reviews\":[{{\"index\":0,\"close_match\":true,\"score\":90}}]}}. Include every candidate with zero-based index. Set close_match=true and score >=80 only for strong fits.",
                genre = resp.benchmark.song_type,
            );
            let review_req = self.gen_req_with_temperature(&review, "You are a strict music taste reviewer. Return valid JSON only.", 0.0)?;
            let reviews: SongReviewResult = self.send(review_req).await?;
            resp.recommends = keep_close_matches(resp.recommends, reviews, candidate_count);
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
            "Liked-song samples: {samples}. The recommendation list is missing these release decades or exact years: {decades:?}. Suggest real, searchable recordings originally released in EACH requested decade or exact year, keeping the SAME dominant primary genre as the listener's samples. Allow compatible subgenres within that primary genre. Avoid recent covers, remixes and reissues of older recordings. Include the exact song name, artist and actual musical style. Return JSON only in this shape: {template}",
            template = crate::types::constants::AI_SONG_RESP_TEMPLATE,
        );
        let req = self.gen_req_with_temperature(&content, "You curate accurate music recommendations across release decades. Return valid JSON only.", 0.4)?;
        let mut resp: AiRecommendInfo = self.send(req).await?;
        if !resp.recommends.is_empty() {
            let candidates = serde_json::to_string(&resp.recommends)?;
            let review = format!(
                "Liked-song samples: {samples}. Independently verify that every candidate is a real recording in the SAME dominant primary genre as these samples and was originally released in one of the requested decades or exact years {decades:?}. Reject uncertain identities, genre-adjacent songs, remasters and recent covers. Candidates: {candidates}. Return JSON only: {{\"reviews\":[{{\"index\":0,\"close_match\":true,\"score\":90}}]}}. Include every candidate with a zero-based index; accept only strong matches with score >=80."
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
