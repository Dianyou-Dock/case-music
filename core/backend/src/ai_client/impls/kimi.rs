use crate::ai_client::Client;
use crate::types::ai_recommend_info::{
    AiRecommendInfo, AiRecommendSingerInfo, AiRecommendSongInfo,
};
use crate::types::apikey::AiApiKey;
use crate::types::constants::{
    gen_daily_recommend_content, gen_recommend_singer_content, gen_recommend_song_content,
    gen_recommend_style_content, AiSource, APIKEY_DIR, APIKEY_FILE, DATA_PATH, KIMI_URL,
};
use crate::types::error::{AiError, ErrorHandle};
use anyhow::Result;
use async_trait::async_trait;
use reqwest::header::CONTENT_TYPE;
use reqwest::{Method, Request};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
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
}

#[derive(Serialize, Deserialize, Debug)]
struct Choice {
    index: usize,
    message: Message,
    finish_reason: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct Usage {
    prompt_tokens: usize,
    completion_tokens: usize,
    total_tokens: usize,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChatResp {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
}

#[allow(dead_code)]
pub struct Kimi {
    client: reqwest::Client,
    apikey: AiApiKey,
    apikey_path: Option<PathBuf>,
}

impl Kimi {
    pub async fn new(api_key: String) -> Result<Kimi> {
        let client = reqwest::Client::new();
        let apikey_dir = DATA_PATH.join(APIKEY_DIR).join(AiSource::Kimi.to_string());
        let apikey_file = apikey_dir.join(APIKEY_FILE);

        if !apikey_dir.exists() {
            fs::create_dir_all(&apikey_dir).await?;
        }

        let apikey = AiApiKey { key: api_key };
        let json = serde_json::to_string_pretty(&apikey)?;
        fs::write(&apikey_file, &json).await?;

        Ok(Kimi {
            client,
            apikey,
            apikey_path: Some(apikey_file),
        })
    }

    pub fn gen_req(&self, content: &str) -> Result<Request> {
        let chat_req = ChatRequest {
            model: "moonshot-v1-8k".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: content.to_string(),
            }],
            temperature: 0.3,
        };

        let req = self.client.request(Method::POST, KIMI_URL);

        let req = req
            .header(CONTENT_TYPE, "application/json")
            .bearer_auth(self.apikey.key.as_str())
            .json(&chat_req)
            .build()?;

        Ok(req)
    }

    pub(crate) fn load() -> Result<Option<Kimi>> {
        let apikey_dir = DATA_PATH.join(APIKEY_DIR).join(AiSource::Kimi.to_string());
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
        };

        Ok(Some(kimi))
    }

    pub async fn send<T: DeserializeOwned>(&self, req: Request) -> Result<T> {
        let resp = self.client.execute(req).await?;

        if !resp.status().is_success() {
            let code = resp.status();
            let bytes = resp.bytes().await?;
            let msg = String::from_utf8(bytes.to_vec())?;
            return Err(anyhow::anyhow!(
                "Kimi server responded with code: {}, error: {}",
                code,
                msg
            ));
        }

        let chat_resp = resp.json::<ChatResp>().await?;
        let data = if let Some(data) = chat_resp.choices.get(0) {
            let content = data.message.content.clone();
            let data = serde_json::from_str::<T>(&content)?;
            data
        } else {
            return Err(AiError::KimiRespNotExistContent.anyhow_err());
        };

        Ok(data)
    }
}

#[async_trait]
impl Client for Kimi {
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

        let content = gen_recommend_song_content(&data.name, count, pre);

        let req = self.gen_req(&content)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }

    async fn daily_recommends(
        &self,
        data: &[AiRecommendSongInfo],
        count: u64,
    ) -> Result<AiRecommendInfo> {
        let sample_playlist = serde_json::to_string_pretty(data)?;

        let exclude_artist = data.iter().map(|v| v.singer.clone()).collect::<Vec<_>>();
        let exclude_artist_str = serde_json::to_string_pretty(&exclude_artist)?;

        let content = gen_daily_recommend_content(&sample_playlist, count, &exclude_artist_str);

        println!("content: {content}");

        let req = self.gen_req(&content)?;

        let resp = self.send(req).await?;

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

        let req = self.gen_req(&content)?;

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

        let req = self.gen_req(&content)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::env;

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
                },
                AiRecommendSongInfo {
                    name: song2.to_string(),
                    singer: singer2.to_string(),
                },
                AiRecommendSongInfo {
                    name: song3.to_string(),
                    singer: singer3.to_string(),
                },
            ];

            let api_key = env::var("API_KEY").unwrap();
            let ai_client = Kimi::new(api_key.to_string()).await.unwrap();

            let result = ai_client
                .daily_recommends(&sample_playlist, 15)
                .await
                .unwrap();

            println!("result len: {}", result.recommends.len());
            println!("result: {}", serde_json::to_string_pretty(&result).unwrap());
        });
    }
}
