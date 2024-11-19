use crate::ai_client::Client;
use crate::types::ai_recommend_info::AiRecommendSongInfo;
use crate::types::constants::{
    gen_recommend_singer_content, gen_recommend_song_content, gen_recommend_style_content, KIMI_URL,
};
use crate::types::error::{AiError, ErrorHandle};
use anyhow::Result;
use async_trait::async_trait;
use reqwest::header::CONTENT_TYPE;
use reqwest::{Method, Request};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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

pub struct Kimi {
    client: reqwest::Client,
    api_key: String,
}

impl Kimi {
    pub fn new(api_key: String) -> Result<Kimi> {
        let client = reqwest::Client::new();
        Ok(Kimi { client, api_key })
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
            .bearer_auth(self.api_key.as_str())
            .json(&chat_req)
            .build()?;

        Ok(req)
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
    ) -> Result<Vec<AiRecommendSongInfo>> {
        let content = gen_recommend_song_content(&data.name, count);

        let req = self.gen_req(&content)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }

    async fn recommend_style(
        &self,
        data: AiRecommendSongInfo,
        count: u64,
    ) -> Result<Vec<AiRecommendSongInfo>> {
        let content = gen_recommend_style_content(&data.name, count);

        let req = self.gen_req(&content)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }

    async fn recommend_singer(
        &self,
        data: AiRecommendSongInfo,
        singer_count: u64,
        song_count: u64,
    ) -> Result<BTreeMap<String, Vec<AiRecommendSongInfo>>> {
        let content = gen_recommend_singer_content(&data.singer, song_count, singer_count);

        let req = self.gen_req(&content)?;

        let resp = self.send(req).await?;

        Ok(resp)
    }
}

#[cfg(test)]
mod test {
    use super::*;

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
            let api_key = "";

            let ai_client = Kimi::new(api_key.to_string()).unwrap();
            let result = ai_client
                .recommend_song(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                    },
                    10,
                )
                .await
                .unwrap();

            println!("{:?}", result);
        });
    }

    #[test]
    fn test_recommend_style() {
        runtime().block_on(async {
            let song = "我们都有问题";
            let singer = "蛋堡";
            let api_key = "";

            let ai_client = Kimi::new(api_key.to_string()).unwrap();
            let result = ai_client
                .recommend_style(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                    },
                    3,
                )
                .await
                .unwrap();

            println!("{:?}", result);
        });
    }

    #[test]
    fn test_recommend_singer() {
        runtime().block_on(async {
            let song = "Luv(sic.) part 3";
            let singer = "Nujabes";
            let api_key = "";

            let ai_client = Kimi::new(api_key.to_string()).unwrap();
            let result = ai_client
                .recommend_singer(
                    AiRecommendSongInfo {
                        name: song.to_string(),
                        singer: singer.to_string(),
                    },
                    2,
                    3,
                )
                .await
                .unwrap();

            println!("{:?}", result);
        });
    }
}
