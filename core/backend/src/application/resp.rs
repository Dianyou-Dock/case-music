use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApplicationResp<T: Serialize + Clone + Debug> {
    pub code: i32,
    pub msg: String,
    pub data: Option<T>,
}

impl<T> ApplicationResp<T>
where
    T: Serialize + Clone + Debug,
{
    pub fn msg_code(msg: String, code: i32) -> ApplicationResp<T> {
        ApplicationResp {
            code,
            msg,
            data: None,
        }
    }

    pub fn fail_msg(msg: String) -> ApplicationResp<T> {
        ApplicationResp {
            code: -1,
            msg,
            data: None,
        }
    }

    pub fn success_data(data: T) -> ApplicationResp<T> {
        ApplicationResp {
            code: 0,
            msg: "".to_string(),
            data: Some(data),
        }
    }

    pub fn success() -> ApplicationResp<T> {
        ApplicationResp{
            code: 0,
            msg: "".to_string(),
            data: None,
        }
    }
}
