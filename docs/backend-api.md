# 后端接口

## AI类

### 相似歌曲推荐
```jsonc

func recommend_song(req) -> resp

req
{
    "name": "",
    "recommend_count": 5
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

### 相似歌手推荐
```jsonc
func recommend_singer(req) -> resp

req
{
    "name": "",
    "recommend_count": 5,
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

### 相似风格推荐
```jsonc
func recommend_style(req) -> resp

req
{
    "song": "",
    "signer": "",
    "recommend_count": 5,
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

## 音乐类

### 获取歌单
```jsonc
func get_song_list(req) -> resp

req
{
    "account": "",
    "password": "",
    "source": "" // NetEaseCloud, AppleMusic, Spotify
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

### 获取歌曲
```jsonc
func get_song(req) -> resp

req
{
    "song": "",
    "singer": "",
    "source": "" // NetEaseCloud, AppleMusic, Spotify
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

### 获取歌手信息
```jsonc
func get_signer(req) -> resp

req
{
    "name": "",
    "source": "" // NetEaseCloud, AppleMusic, Spotify
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

### 获取歌词
```jsonc
func get_lyrics(req) -> resp

req
{
    "song": "",
    "signer": "",
    "source": "" // NetEaseCloud, AppleMusic, Spotify
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```

### 获取歌曲的专辑信息
```jsonc
func get_song_album(req) -> resp

req
{
    "song": "",
    "signer": "",
    "source": "" // NetEaseCloud, AppleMusic, Spotify
}

resp
{
    "code": 0,
    "msg": "",
    "data": {}
}
```