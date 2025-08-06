pub mod likes;
pub mod models;
pub mod details;

// 重新导出常用的结构体，便于使用
pub use models::SavedTrack;
pub use models::SavedTracksResponse;
pub use models::GetSavedTracksResponse;

pub use likes::*;
pub use details::*; 