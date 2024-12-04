use dirs_next::home_dir;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use strum_macros::{Display, EnumString};

pub static KIMI_URL: &str = "https://api.moonshot.cn/v1/chat/completions";

pub static AI_SONG_RESP_TEMPLATE: &str = r#"
return format should be like this:
{
    "recommends": [
        {
            "name": "song name",
            "singer": "singer name"
        },
        {
            "name": "song name",
            "singer": "singer name"
        }
    ],
    "benchmark": {
        "song_type": "Song type, at least 3 types",
        "song_detail": "Describe this song in a little more detail",
        "recommend_detail": "Briefly describe the playlist you want to recommend"
    }
}

"#;

pub static AI_RESP_SINGER_TEMPLATE: &str = r#"
return format should be like this:
{
    "benchmark": {
        "song_type": "Song type, at least 3 types",
        "song_detail": "Describe this song in a little more detail",
        "recommend_detail": "Briefly describe the playlist you want to recommend"
    },
    "recommends": {
        "singer name": [
            {
                "name": "song name",
                "singer": "singer name"
            },
            {
                "name": "song name",
                "singer": "singer name"
            }
        ],
        "singer name": [
            {
                "name": "song name",
                "singer": "singer name"
            },
            {
                "name": "song name",
                "singer": "singer name"
            }
        ]
    }

}
"#;

pub static AI_RECOMMEND_SONG: &str = r#"recommend songs similar to this for me"#;

pub static AI_RECOMMEND_SINGER: &str = r#"recommend other artists similar to this one for me"#;

pub static AI_RECOMMEND_STYLE: &str = r#"recommend songs with a similar style for me"#;

pub static AI_RAND_RECOMMEND_SONGS: &str =
    r#"recommend similar songs but orther artist for each song in the sample list"#;
pub static AI_RAND_RECOMMEND_EACH_COUNT: &str =
    "recommend similar songs for each sample song, count:";
pub static AI_RECOMMEND_SONG_COUNT: &str = r#"recommend song count:"#;

pub static AI_RECOMMEND_SINGER_COUNT: &str = r#"recommend artists count:"#;

pub static AI_RECOMMEND_SINGER_SONG_COUNT: &str = r#"recommend each artists song count:"#;

pub static AI_RECOMMEND_RULES: &str = r#"
resp rule:
1. no text outside the template,
2. `song_type` reply in english,
3. `song_detail` 用中文回复,
4. `recommend_detail` 用中文回复,
"#;

pub static DATA_DIR: &str = ".fma";
pub static AUTH_DIR: &str = "auth";

pub static APIKEY_DIR: &str = "apikey";

pub static AUTH_FILE: &str = "auth.json";

pub static APIKEY_FILE: &str = "apikey.json";

pub static DATA_PATH: Lazy<PathBuf> = Lazy::new(|| {
    if let Some(home_dir) = home_dir() {
        let data_dir = home_dir.join(DATA_DIR);
        if !data_dir.exists() {
            fs::create_dir_all(&data_dir).unwrap();
        }

        let cookie_dir = home_dir.join(AUTH_DIR);
        if !cookie_dir.exists() {
            fs::create_dir_all(&cookie_dir).unwrap();
        }

        data_dir
    } else {
        panic!("Home directory not found");
    }
});

pub const BASE_NETESAE_URL_LIST: [&str; 12] = [
    "https://music.163.com/",
    "https://music.163.com/eapi/clientlog",
    "https://music.163.com/eapi/feedback",
    "https://music.163.com/api/clientlog",
    "https://music.163.com/api/feedback",
    "https://music.163.com/neapi/clientlog",
    "https://music.163.com/neapi/feedback",
    "https://music.163.com/weapi/clientlog",
    "https://music.163.com/weapi/feedback",
    "https://music.163.com/wapi/clientlog",
    "https://music.163.com/wapi/feedback",
    "https://music.163.com/openapi/clientlog",
];

pub static NETEASE_DOMAIN: &str = "music.163.com";

pub fn gen_recommend_song_content(song: &str, count: u64, previous: Option<String>) -> String {
    let template = format!(
        "song: '{song}', \
        {AI_RECOMMEND_SONG}, \
        {AI_RECOMMEND_SONG_COUNT} {count}, \
        {AI_RECOMMEND_RULES}, \
        {AI_SONG_RESP_TEMPLATE}"
    );

    if let Some(previous) = previous {
        format!("{template}, exclude: {previous}")
    } else {
        template
    }
}

pub fn gen_recommend_style_content(song: &str, count: u64, previous: Option<String>) -> String {
    let template = format!(
        "song: '{song}', \
        {AI_RECOMMEND_STYLE}, \
        {AI_RECOMMEND_SONG_COUNT} {count}, \
        {AI_RECOMMEND_RULES}, \
        {AI_SONG_RESP_TEMPLATE}"
    );

    if let Some(previous) = previous {
        format!("{template}, exclude: {previous}")
    } else {
        template
    }
}

pub fn gen_recommend_singer_content(
    singer: &str,
    song_count: u64,
    singer_count: u64,
    previous: Option<String>,
) -> String {
    let template = format!(
        "artist: '{singer}', \
        {AI_RECOMMEND_SINGER}, \
        {AI_RECOMMEND_SONG_COUNT} {song_count}, \
        {AI_RECOMMEND_SINGER_COUNT} {singer_count} ,\
        {AI_RECOMMEND_RULES}, \
        {AI_RESP_SINGER_TEMPLATE}"
    );

    if let Some(previous) = previous {
        format!("{template}, exclude artist: {previous}")
    } else {
        template
    }
}

pub fn gen_rand_recommend_content(song_list: &str, count: u64, exclude_artist: &str) -> String {
    let template = format!(
        "song list: '{song_list}', \
        {AI_RAND_RECOMMEND_SONGS}, \
        {AI_RECOMMEND_SONG_COUNT} {count}, \
        {AI_RECOMMEND_RULES}, \
        {AI_SONG_RESP_TEMPLATE}, \
        exclude artist: {exclude_artist}"
    );

    template
}

#[derive(Serialize, Deserialize, Debug, Clone, EnumString, Display)]
pub enum MusicSource {
    #[strum(serialize = "Netesae")]
    Netesae,
    #[strum(serialize = "Spotify")]
    Spotify,
    #[strum(serialize = "QQ")]
    QQ,
    #[strum(serialize = "Apple")]
    Apple,
}

#[derive(Serialize, Deserialize, Debug, Clone, EnumString, Display)]
pub enum AiSource {
    #[strum(serialize = "Kimi")]
    Kimi,
}

pub static RAND_RECOMMENDS_BENCHMARK_COUNT: usize = 3;
pub static RAND_RECOMMENDS_COUNT: usize = 30;
