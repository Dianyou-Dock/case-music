//! 对外统一客户端入口与 typed builder 导出。
//!
//! # Overview
//!
//! 本模块聚合了所有公开请求构建器，并通过 [`MusicClient`] 暴露统一入口。
//! 业务术语与类型态约束定义以 crate 级文档 [`crate`] 为准，本模块仅描述入口与导出关系。
//!
//! # Quick Start
//!
//! ```no_run
//! # async fn run() -> Result<(), netease_qq_music_api::MusicClientError> {
//! let client = netease_qq_music_api::MusicClient::new();
//! let lyric = client.playback().lyric().id("108914").send().await?;
//! println!("lyric len: {}", lyric.lyric.len());
//! # Ok(())
//! # }
//! ```
//!
//! # Core Concepts
//!
//! - 域入口方法：[`MusicClient::search`]、[`MusicClient::detail`]、[`MusicClient::playback`]、
//!   [`MusicClient::discover`]、[`MusicClient::playlist`]、[`MusicClient::login`]。
//! - `*Request<'a, K>`：链式请求构建器。
//! - `*Kind`：类型态标记，约束不同阶段可调用的方法集合。
//! - [`LoginTokenRef`][`crate::client::LoginTokenRef`]：跨平台 token 借用包装。
//!
//! # Errors and Panics
//!
//! - 请求失败通过 [`MusicClientError`][`crate::error::MusicClientError`] 返回，不以 panic
//!   作为业务控制流。
//! - 参数缺失、平台不匹配与网络错误都可通过错误变体区分。
//! - 与错误变体语义相关的规范定义见 [`crate::error`]。
//!
//! # See Also
//!
//! - [`models`][`crate::models`]：请求返回的统一数据模型。
//! - [`error`][`crate::error`]：错误定义与结果类型。

use crate::platform::{NeteaseClient, TencentClient};

mod detail;
mod discover;
mod login;
mod playback;
mod playlist;
mod search;
mod utils;

/// 详情域请求构建器及其类型态标记。
pub use detail::{
    DetailAlbumKind, DetailArtistKind, DetailKind, DetailPlaylistKind, DetailRequest,
    DetailSongKind, DetailToplistKind,
};
/// 发现域请求构建器及其类型态标记。
pub use discover::{
    DiscoverHotkeyKind, DiscoverKind, DiscoverPlaylistCategoriesKind, DiscoverPlaylistListKind,
    DiscoverRecommendPlaylistKind, DiscoverRequest, DiscoverSearchSuggestsKind,
    DiscoverToplistListKind,
};
/// 登录域请求构建器、会话对象与类型态标记。
pub use login::{LoginKind, LoginRefreshKind, LoginRequest, LoginSession, LoginSessionKind};
/// 播放域请求构建器及其类型态标记。
pub use playback::{PlaybackKind, PlaybackLyricKind, PlaybackRequest, PlaybackUrlKind};
/// 歌单域请求构建器及其类型态标记。
pub use playlist::{
    PlaylistCategoriesKind, PlaylistDetailKind, PlaylistKind, PlaylistListKind, PlaylistRequest,
};
/// 搜索域请求构建器及其类型态标记。
pub use search::{
    SearchAlbumKind, SearchArtistKind, SearchKind, SearchPlaylistKind, SearchRequest,
    SearchSongKind,
};
/// 统一 token 借用类型，用于跨平台鉴权参数传递。
pub use utils::LoginTokenRef;
/// 统一 ID 输入抽象，支持 [`u64`] 与字符串。
pub use utils::MusicIdInput;

#[cfg(test)]
mod tests;

/// 统一音乐客户端入口。
///
/// 该类型本身不携带业务参数，只负责创建各业务域请求构建器。
/// 默认平台为 [`Platform::Netease`][`crate::models::Platform::Netease`]，你可以在构建器上通过
/// `.platform(...)` 切换。
///
/// # Examples
///
/// ```no_run
/// # async fn run() -> Result<(), netease_qq_music_api::MusicClientError> {
/// let client = netease_qq_music_api::MusicClient::new();
/// let result = client.search().song().keyword("林俊杰").send().await?;
/// println!("found: {}", result.songs.len());
/// # Ok(())
/// # }
/// ```
pub struct MusicClient {
    netease: NeteaseClient,
    tencent: TencentClient,
}

impl Default for MusicClient {
    fn default() -> Self {
        Self::new()
    }
}

impl MusicClient {
    /// 读取 QQ 音乐账号的自建、收藏歌单与“我喜欢”。
    pub async fn tencent_user_playlists(
        &self,
        token: &crate::models::TencentLoginToken,
    ) -> crate::error::MusicClientResult<crate::models::TencentUserPlaylists> {
        self.tencent.user_playlists(token).await
    }

    /// 读取 QQ 音乐账号歌单曲目；“我喜欢”使用 `qq-liked:201`。
    pub async fn tencent_user_playlist(
        &self,
        id: &str,
        token: &crate::models::TencentLoginToken,
    ) -> crate::error::MusicClientResult<crate::models::PlaylistDetailResult> {
        if id != "qq-liked:201" && (id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_digit()))
        {
            return Err(crate::error::MusicClientError::InvalidIdFormat(id.to_owned()));
        }
        self.tencent.user_playlist(id, token).await
    }
    /// 查询 QQ 音乐歌曲收藏状态。
    pub async fn tencent_liked_status(
        &self,
        ids: &[String],
        token: &crate::models::TencentLoginToken,
    ) -> crate::error::MusicClientResult<Vec<bool>> {
        self.tencent.liked_status(ids, token).await
    }
    /// 修改 QQ 音乐“我喜欢”，成功时会读回确认。
    pub async fn tencent_set_liked(
        &self,
        id: &str,
        liked: bool,
        token: &crate::models::TencentLoginToken,
    ) -> crate::error::MusicClientResult<()> {
        self.tencent.set_liked(id, liked, token).await
    }
    /// 获取 QQ 音乐相似歌曲，参数为数字歌曲 ID。
    pub async fn tencent_similar_songs(
        &self,
        song_id: u64,
    ) -> crate::error::MusicClientResult<Vec<crate::models::Song>> {
        self.tencent.similar_songs(song_id).await
    }
    /// 创建新的客户端实例。
    ///
    /// 返回值可复用，用于发起多个独立请求。
    pub fn new() -> Self {
        Self { netease: NeteaseClient::new(), tencent: TencentClient::new() }
    }

    /// 创建搜索域请求构建器。
    pub fn search(&self) -> SearchRequest<'_, SearchKind> {
        SearchRequest::new(self)
    }

    /// 创建详情域请求构建器。
    pub fn detail(&self) -> DetailRequest<'_, DetailKind> {
        DetailRequest::new(self)
    }

    /// 创建播放域请求构建器。
    pub fn playback(&self) -> PlaybackRequest<'_, PlaybackKind> {
        PlaybackRequest::new(self)
    }

    /// 创建发现域请求构建器。
    pub fn discover(&self) -> DiscoverRequest<'_, DiscoverKind> {
        DiscoverRequest::new(self)
    }

    /// 创建歌单域请求构建器。
    pub fn playlist(&self) -> PlaylistRequest<'_, PlaylistKind> {
        PlaylistRequest::new(self)
    }

    /// 创建登录域请求构建器。
    pub fn login(&self) -> LoginRequest<'_, LoginKind> {
        LoginRequest::new(self)
    }
}
