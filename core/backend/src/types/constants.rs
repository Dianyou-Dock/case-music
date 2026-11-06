use dirs_next::home_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use strum_macros::{Display, EnumString};

pub static KIMI_URL: &str = "https://api.moonshot.cn/v1/chat/completions";
pub static DEEPSEEK_URL: &str = "https://api.deepseek.com/chat/completions";
pub static ACTIVE_AI_SOURCE_FILE: &str = "active-ai-source.json";

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

static DATA_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn set_data_path(path: PathBuf) -> std::io::Result<()> {
    fs::create_dir_all(&path)?;
    DATA_PATH.set(path).expect("Data path already initialized");
    Ok(())
}

pub fn data_path() -> &'static PathBuf {
    DATA_PATH.get_or_init(|| {
        let path = home_dir().expect("Home directory not found").join(DATA_DIR);
        fs::create_dir_all(&path).expect("Could not create data directory");
        path
    })
}

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

pub fn gen_recommend_song_content(
    song: &str,
    singer: &str,
    count: u64,
    previous: Option<String>,
) -> String {
    let template = format!(
        "Sample recording: song '{song}', artist '{singer}'. \
        First identify its primary major genre and subgenre and its defining groove, tempo, vocals, \
        instrumentation and era. Recommend up to {count} REAL, searchable recordings in the \
        SAME primary major genre and matching at least two of those musical traits. \
        Include different subgenres within that major genre when the sound still fits. \
        Do not recommend a song solely because its artist is adjacent, it shares a broad genre, \
        or it is commonly found on a generic mood playlist. Do not include remixes, covers, \
        unrelated genres or the sample itself. Be conservative: return fewer than {count} \
        songs if you cannot identify enough close matches. For every result, put its actual \
        primary genre/subgenre in song_type; do not copy the sample's genre when it is untrue. \
        In benchmark.song_type identify the sample's primary genre FIRST, then any more precise \
        subgenres. Explain the shared musical traits in recommend_detail. \
        song_type must be in English; song_detail and recommend_detail must be in Chinese. \
        Song title and artist must identify the same real recording. Return only this JSON shape: \
        {AI_SONG_RESP_TEMPLATE}"
    );

    if let Some(previous) = previous {
        format!("{template}, exclude: {previous}")
    } else {
        template
    }
}

pub fn gen_single_song_prompt() -> String {
    format!(
        "You are a careful music similarity curator. A single song and artist identify the \
        recording to match. Keep its primary major genre fixed while exploring compatible \
        subgenres within it. Do not pad the list. If unsure whether a recording has the \
        same primary major genre, omit it. Include different artists and some new recordings \
        by the sample artist; at most two recordings by the same artist. Seek both current-year \
        recordings and recordings from at least ten years ago when real matches exist. \
        Return only a valid JSON object in this shape: {AI_SONG_RESP_TEMPLATE}"
    )
}

pub fn gen_single_song_review_content(
    song: &str,
    singer: &str,
    benchmark: &str,
    candidates: &str,
) -> String {
    format!(
        "Audit these proposed recommendations for the recording '{song}' by '{singer}'. \
        The first pass described the sample as: {benchmark}. \
        Independently check each candidate's ACTUAL recording and style. A match needs the \
        same primary major genre AND at least two of groove, vocal style, production and tempo. \
        Compatible subgenres within that major genre are allowed. \
        Reject broad R&B/pop adjacency, genre crossover dominated by another style, \
        uncertain song/artist identities, and songs you do not know well enough to judge. \
        Do not trust the candidate's song_type label without checking it. \
        Candidates in order: {candidates}. \
        Return JSON only: {{\"reviews\":[{{\"index\":0,\"close_match\":true,\"score\":90}}]}}. \
        Include EVERY candidate exactly once; index is zero-based. Only set close_match=true \
        when the match is strong, and score strong matches at least 80. Be strict; fewer songs \
        are preferable to unrelated songs."
    )
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
    let year = time::OffsetDateTime::now_utc().year();
    format!(
        r#"
你将收到从用户喜欢的歌曲中抽取的列表，格式如下:

{AI_SONG_REQ_EXAMPLE}

先找出样本里最有代表性的大风格，把它写入 benchmark.song_type。候选歌曲必须属于同一个大风格，可以在这个大风格内部探索不同细分风格；不接受只沾边或跨界但由其他大风格主导的歌曲。每个示例都应有一定代表，不要让某位歌手占据整张列表。不要为了随机性、冷门或语言多样性牺牲匹配度。不要返回示例歌曲。
候选中要有样本歌手之外的新歌手，也允许样本歌手的新歌曲；同一歌手最多两首。尽量包含今年（{year}）发行的歌曲和至少十年前发行的歌曲，并横跨多个十年档位。不要把近期翻唱或再版当作旧歌。年代跨度不能牺牲风格匹配；找不到合格的歌曲就少推荐。返回结构如下格式:

{AI_SONG_RESP_TEMPLATE}

歌曲名与歌手必须准确对应，优先选择能在音源中搜索到的歌曲。每次按用户要求返回足量候选；同一歌手最多两首。song_type 用英文，song_detail 和 recommend_detail 用中文。
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

pub fn gen_rand_recommend_content(song_list: &str, count: u64) -> String {
    let template = format!("Liked songs sampled from the user's library: {song_list}. Choose the dominant primary genre and put it in benchmark.song_type. Recommend up to {count} distinct real songs in that SAME primary genre. Include unfamiliar artists and allow new recordings by familiar artists. Cover old and current-year releases where genuine same-genre candidates exist. Vary subgenres within that primary genre. Mark each candidate's actual style in song_type; do not relabel a mismatched recording. Return fewer songs rather than cross-genre filler. Return only valid JSON.");

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

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, EnumString, Display)]
pub enum AiSource {
    #[strum(serialize = "Kimi")]
    Kimi,
    #[strum(serialize = "DeepSeek")]
    DeepSeek,
}

impl AiSource {
    pub fn display_list() -> Vec<DisplayData> {
        vec![
            DisplayData {
                id: AiSource::Kimi.to_string(),
                name: "Kimi AI".to_string(),
                desc: "Set your Kimi API key".to_string(),
            },
            DisplayData {
                id: AiSource::DeepSeek.to_string(),
                name: "DeepSeek".to_string(),
                desc: "Set your DeepSeek API key".to_string(),
            },
        ]
    }
}

pub static RAND_RECOMMENDS_BENCHMARK_COUNT: usize = 6;
pub static RAND_RECOMMENDS_COUNT: usize = 15;

pub static RAND_RECOMMEND_AVG: usize = RAND_RECOMMENDS_COUNT / RAND_RECOMMENDS_BENCHMARK_COUNT;
