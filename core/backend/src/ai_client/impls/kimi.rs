use std::collections::BTreeMap;
use async_trait::async_trait;
use crate::ai_client::Client;
use crate::types::ai_recommend_info::AiRecommendSongInfo;
use crate::types::song_info::SongInfoData;
use anyhow::Result;
use reqwest::{Method, Request};
use reqwest::header::{CONTENT_TYPE};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use crate::types::constants::KIMI_URL;

pub struct Kimi {
    client: reqwest::Client,
    api_key: String,
}


impl Kimi {
    pub fn new(api_key: String) -> Result<Kimi> {
        let client = reqwest::Client::new();
        Ok(Kimi { client, api_key })
    }

    pub fn gen_req(&self, data: &str) -> Result<Request> {
        let req = self.client.request(Method::POST, KIMI_URL);

        let req = req.header(CONTENT_TYPE, "application/json")
            .bearer_auth(self.api_key.as_str())
            .body(data.to_string())
            .build()?;

        Ok(req)
    }

    pub async fn send<T: DeserializeOwned>(&self, req: Request) -> Result<T> {
        let resp = self.client.execute(req).await?;

        if !resp.status().is_success() {
            let code = resp.status();
            let bytes = resp.bytes().await?;
            let msg = String::from_utf8(bytes.to_vec())?;
            return Err(anyhow::anyhow!("Kimi server responded with code: {}, error: {}", code, msg));
        }

        let data = resp.json::<T>().await?;

        Ok(data)
    }
}

#[async_trait]
impl Client for Kimi {
    async fn recommend_song(&self, data: AiRecommendSongInfo, count: u64) -> Result<Vec<AiRecommendSongInfo>> {
        todo!()
    }

    async fn recommend_style(&self, data: AiRecommendSongInfo, count: u64) -> Result<Vec<AiRecommendSongInfo>> {
        todo!()
    }

    async fn recommend_singer(&self, data: AiRecommendSongInfo, singer_count: u64, song_count: u64) -> Result<BTreeMap<String, Vec<AiRecommendSongInfo>>> {
        todo!()
    }
}