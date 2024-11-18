pub static KIMI_URL: &str = "https://api.moonshot.cn";

pub static AI_SONG_RESP_TEMPLATE : &str = r#"
return format should be like this:
[
    {
        "name": "song name",
        "signer": "singer name"
    },
    {
        "name": "song name",
        "signer": "singer name"
    }
]
"#;

pub static AI_RESP_SINGER_TEMPLATE : &str = r#"
return format should be like this:
{
    "singer name": [
        {
            "name": "song name",
            "signer": "singer name"
        },
        {
            "name": "song name",
            "signer": "singer name"
        }
    ],
    "singer name": [
        {
            "name": "song name",
            "signer": "singer name"
        },
        {
            "name": "song name",
            "signer": "singer name"
        }
    ]
}
"#;

pub static AI_RECOMMEND_SONG: &str = r#"recommend songs similar to this for me"#;

pub static AI_RECOMMEND_SINGER: &str = r#"recommend artists similar to this for me"#;

pub static AI_RECOMMEND_STYLE: &str = r#"recommend songs with a similar style for me"#;

pub static AI_RECOMMEND_SONG_COUNT: &str = r#"recommend song count:"#;

pub static AI_RECOMMEND_SINGER_COUNT: &str = r#"recommend artists count:"#;

pub static AI_RECOMMEND_SINGER_SONG_COUNT: &str = r#"recommend each artists song count:"#;

pub static AI_RECOMMEND_RULES: &str = r#"
resp rule:
1. no text outside the template
"#;

pub fn gen_recommend_song_content(song: &str, count: u64) -> String {
    format!("song: '{song}', {AI_RECOMMEND_SONG}, {AI_RECOMMEND_SONG_COUNT} {count}, {AI_RECOMMEND_RULES}, {AI_SONG_RESP_TEMPLATE}")
}

pub fn gen_recommend_style(song: &str, count: u64) -> String {
    format!("song: '{song}', {AI_RECOMMEND_STYLE}, {AI_RECOMMEND_SONG_COUNT} {count}, {AI_RECOMMEND_RULES}, {AI_SONG_RESP_TEMPLATE}")
}

pub fn gen_recommend_singer(singer: &str, song_count: u64, singer_count: u64) -> String {
    format!("artist: '{singer}', {AI_RECOMMEND_SINGER}, {AI_RECOMMEND_SONG_COUNT} {song_count}, {AI_RECOMMEND_SINGER_COUNT} {singer_count} ,{AI_RECOMMEND_RULES}, {AI_RESP_SINGER_TEMPLATE}")
}