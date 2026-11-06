# QQ 音乐接入

应用使用 [Dianyou-Dock/netease-qq-music-api](https://github.com/Dianyou-Dock/netease-qq-music-api) Rust fork（MIT）连接 QQ 音乐，并在 Cargo 中固定提交。桌面版和 Android 版共用同一后端实现，不需要 Node 服务。

在“设置 → QQ 音乐”点击连接，使用 QQ 音乐客户端扫描二维码并确认。登录后从“喜爱列表”“歌单”“随机推荐”中选择 QQ 音乐。登录凭证保存在应用数据目录的 `qqmusic-token.json`，退出登录时删除。到期前会尝试刷新凭证。

目前支持账号自建及收藏歌单、“我喜欢”曲目、随机推荐歌单中的歌曲，以及播放器的暂停、切歌和进度跳转。账号歌单与“我喜欢”的请求与模型封装在 Rust fork 中。歌曲能否播放取决于 QQ 音乐返回的链接、账号权益和地区。

这个库调用的是非公开接口。构建通过只能证明代码可编译；扫码及实际播放需要用自己的账号在目标设备上验证。
