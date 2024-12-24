use dirs_next::home_dir;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use strum_macros::{Display, EnumString};

pub static KIMI_URL: &str = "https://api.moonshot.cn/v1/chat/completions";

pub static AI_SONG_REQ_EXAMPLE: &str = r#"
[
        {
            "name": "song name",
            "singer": "singer name",
            "song_type": "Song type"
        },
        {
            "name": "song name",
            "singer": "singer name",
            "song_type": "Song type"
        }
]
"#;

pub static AI_SONG_RESP_TEMPLATE: &str = r#"
{
    "recommends": [
        {
            "name": "song name",
            "singer": "singer name",
            "song_type": "Song type"
        },
        {
            "name": "song name",
            "singer": "singer name",
            "song_type": "Song type"
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
                "singer": "singer name",
                "song_type": "Song type"
            },
            {
                "name": "song name",
                "singer": "singer name",
                "song_type": "Song type"
            }
        ],
        "singer name": [
            {
                "name": "song name",
                "singer": "singer name",
                "song_type": "Song type"
            },
            {
                "name": "song name",
                "singer": "singer name",
                "song_type": "Song type"
            }
        ]
    }
}
"#;

pub static AI_RECOMMEND_SONG: &str = r#"recommend songs similar to this for me"#;

pub static AI_RECOMMEND_SINGER: &str = r#"recommend other artists similar to this one for me"#;

pub static AI_RECOMMEND_STYLE: &str = r#"recommend songs with a similar style for me"#;

pub static AI_RAND_RECOMMEND_SONGS: &str =
    r#"recommend similar songs and similar artist for each song in the sample list"#;
pub static AI_RAND_RECOMMEND_EACH_COUNT: &str =
    "recommend similar songs for each sample song, count:";
pub static AI_RECOMMEND_SONG_COUNT: &str = r#"recommend song count:"#;

pub static AI_RECOMMEND_SINGER_COUNT: &str = r#"recommend artists count:"#;

pub static AI_RECOMMEND_SINGER_SONG_COUNT: &str = r#"recommend each artists song count:"#;

pub static AI_RECOMMEND_RULES: &str = r#"
1. `song_type` reply in english.
2. `song_detail` 用中文回复.
3. `recommend_detail` 用中文回复.
4. 你返回的歌手和歌曲必须准确对应,不能出现匹配不上的情况
5. 你收到过的歌曲不能返回.
6. 返回的列表中要包含多种语言.
7. 返回的歌曲要冷门小众的.
8. 返回的歌曲要非常随机.
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
        "Example song: '{song}', \
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

pub fn gen_ai_singer_prompt() -> String {
    format!(
        r#"
你将收到一个音乐列表,格式如下:

{AI_SONG_REQ_EXAMPLE}

根据用户输入的示例来返回相对应的音乐,返回结构如下格式:

{AI_SONG_RESP_TEMPLATE}

返回的数据有如下规则:

{AI_RECOMMEND_RULES}

平均每个示例对应返回{RAND_RECOMMEND_AVG}首, 返回的推荐列表必须包含{RAND_RECOMMENDS_COUNT}首
    "#
    )
}

pub fn gen_recommend_singer_content(
    singer: &str,
    song_count: u64,
    singer_count: u64,
    previous: Option<String>,
) -> String {
    let template = format!(
        "Example artist: '{singer}', \
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

pub fn gen_rand_recommend_content(song_list: &str, _count: u64) -> String {
    let template = format!("Example song list: '{song_list}'");

    template
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DisplayData {
    pub id: String,
    pub name: String,
    pub desc: String,
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

impl MusicSource {
    pub fn display_list() -> Vec<DisplayData> {
        vec![
            DisplayData {
                id: MusicSource::Netesae.to_string(),
                name: "NetEase CloudMusic".to_string(),
                desc: "Connect to your NetEase CloudMusic account".to_string(),
            },
            DisplayData {
                id: MusicSource::Spotify.to_string(),
                name: "Spotify".to_string(),
                desc: "Connect to your Spotify account".to_string(),
            },
            DisplayData {
                id: MusicSource::QQ.to_string(),
                name: "QQ Music".to_string(),
                desc: "Connect to your QQ Music account".to_string(),
            },
            DisplayData {
                id: MusicSource::Apple.to_string(),
                name: "Apple Music".to_string(),
                desc: "Connect to your Apple Music account".to_string(),
            },
        ]
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, EnumString, Display)]
pub enum AiSource {
    #[strum(serialize = "Kimi")]
    Kimi,
}

impl AiSource {
    pub fn display_list() -> Vec<DisplayData> {
        vec![DisplayData {
            id: AiSource::Kimi.to_string(),
            name: "Kimi Ai".to_string(),
            desc: "Set your Kimi api key".to_string(),
        }]
    }
}

pub static RAND_RECOMMENDS_BENCHMARK_COUNT: usize = 3;
pub static RAND_RECOMMENDS_COUNT: usize = 15;

pub static RAND_RECOMMEND_AVG: usize = RAND_RECOMMENDS_COUNT / RAND_RECOMMENDS_BENCHMARK_COUNT;
