import { ref, computed, watchEffect } from 'vue'
import { Howl } from 'howler'

export interface Track {
  id: string
  title: string
  artist?: string
  url: string
  cover?: string
  href: string
  duration_ms: number
  external_url?: string
  web_url?: string
  album_name?: string
  release_date?: string
  explicit?: boolean
  popularity?: number
  uri?: string
  track_number?: number
  disc_number?: number
  is_local?: boolean
  artist_id?: string
  album_id?: string
  liked?: boolean
}

export default function usePlayer() {
  // 音乐播放器状态
  const currentTrack = ref<Track | null>(null)
  const playlist = ref<Track[]>([])
  const sound = ref<Howl | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref('0:00')
  const totalTime = ref('0:00')
  const progress = ref(0)
  const volume = ref(50)
  const isBackward = ref(false)
  const isForward = ref(false)
  const currentIndex = ref(-1)
  // 播放模式：0=列表循环, 1=单曲循环, 2=随机播放
  const playMode = ref(0)

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`
  }

  // 更新进度条
  const updateProgress = () => {
    if (sound.value && sound.value.playing()) {
      const seek = sound.value.seek() || 0
      progress.value = (seek / sound.value.duration()) * 100 || 0
      currentTime.value = formatTime(seek)
      requestAnimationFrame(updateProgress)
    }
  }

  // 播放特定歌曲
  const playTrack = (track: Track) => {
    // 如果当前有音乐在播放，先停止
    if (sound.value) {
      sound.value.stop()
    }
    
    // 设置当前曲目
    currentTrack.value = track
    
    // 查找并设置当前播放索引
    const trackIndex = playlist.value.findIndex(t => t.id === track.id)
    if (trackIndex !== -1) {
      currentIndex.value = trackIndex
    }
    
    // 更新总时长
    if (track.duration_ms) {
      totalTime.value = formatTime(track.duration_ms / 1000)
    }
    
    // 如果没有预览URL，自动使用Spotify链接打开播放
    if (!track.url) {
      // 设置为不播放状态
      isPlaying.value = false
      
      // 优先使用web_url（专门为前端准备的链接）
      if (track.web_url) {
        window.open(track.web_url, '_blank')
      } else if (track.external_url) {
        window.open(track.external_url, '_blank')
      } else if (track.uri) {
        // 尝试使用URI打开Spotify应用
        window.open(`spotify:track:${track.id}`, '_blank')
      } else if (track.id) {
        // 使用ID构建Spotify网页链接
        window.open(`https://open.spotify.com/track/${track.id}`, '_blank')
      }
      return;
    }
    
    // 创建新的Howl实例
    sound.value = new Howl({
      src: [track.url],
      html5: true,
      volume: volume.value / 100,
      onplay: () => {
        isPlaying.value = true
        requestAnimationFrame(updateProgress)
      },
      onpause: () => {
        isPlaying.value = false
      },
      onstop: () => {
        isPlaying.value = false
      },
      onend: () => {
        isPlaying.value = false
        if (playMode.value === 1) {
          // 单曲循环模式：重新播放当前歌曲
          setTimeout(() => {
            if (sound.value) {
              sound.value.seek(0)
              sound.value.play()
            }
          }, 100)
        } else {
          // 列表循环或随机播放：播放下一首
          playNext()
        }
      },
      onload: () => {
        // 更新总时长
        if (sound.value) {
          const duration = sound.value.duration()
          totalTime.value = formatTime(duration)
        }
      }
    })
    
    sound.value.play()
  }

  // 通过索引播放歌曲
  const playTrackByIndex = (index: number) => {
    if (index >= 0 && index < playlist.value.length) {
      currentIndex.value = index
      playTrack(playlist.value[index])
    }
  }

  // 播放/暂停切换
  const togglePlay = () => {
    if (!sound.value) {
      // 如果没有加载任何歌曲，尝试播放播放列表中的第一首
      if (playlist.value.length > 0) {
        playTrackByIndex(0)
      }
      return
    }
    
    if (sound.value.playing()) {
      sound.value.pause()
    } else {
      sound.value.play()
    }
  }

  // 上一首
  const playPrevious = () => {
    isBackward.value = true
    
    // 如果当前播放进度超过3秒，则重新从头播放当前歌曲
    if (sound.value && sound.value.seek() > 3) {
      sound.value.seek(0)
    } else {
      // 否则播放上一首
      let prevIndex = currentIndex.value - 1
      if (prevIndex < 0) {
        prevIndex = playlist.value.length - 1 // 循环到列表末尾
      }
      playTrackByIndex(prevIndex)
    }
    
    setTimeout(() => {
      isBackward.value = false
    }, 200)
  }

  // 下一首
  const playNext = () => {
    isForward.value = true
    
    if (playMode.value === 2) {
      // 随机播放模式
      const randomIndex = Math.floor(Math.random() * playlist.value.length)
      playTrackByIndex(randomIndex)
    } else {
      // 列表循环或单曲循环模式：顺序播放下一首
      let nextIndex = currentIndex.value + 1
      if (nextIndex >= playlist.value.length) {
        nextIndex = 0 // 循环到列表开头
      }
      playTrackByIndex(nextIndex)
    }
    
    setTimeout(() => {
      isForward.value = false
    }, 200)
  }

  // 设置进度
  const setProgress = (value: number) => {
    if (sound.value) {
      const duration = sound.value.duration()
      sound.value.seek(duration * (value / 100))
      // 更新当前时间显示
      const seek = sound.value.seek() || 0
      currentTime.value = formatTime(seek)
    } else if (currentTrack.value && currentTrack.value.duration_ms) {
      // 即使没有声音实例，也更新进度显示（适用于不可预览的歌曲）
      const duration = currentTrack.value.duration_ms / 1000;
      const seek = duration * (value / 100);
      currentTime.value = formatTime(seek);
      progress.value = value;
    }
  }

  // 当拖动进度条时调用
  const startDraggingProgress = () => {
    // 可以在这里暂停播放，以便更好地拖动
    if (sound.value && sound.value.playing()) {
      sound.value.pause();
    }
  }
  
  // 当释放进度条时调用
  const endDraggingProgress = () => {
    // 如果之前在播放，则恢复播放
    if (isPlaying.value && sound.value) {
      sound.value.play();
    }
  }

  // 设置播放列表
  const setPlaylist = (tracks: Track[]) => {
    playlist.value = tracks
  }

  // 添加到播放列表
  const addToPlaylist = (track: Track) => {
    playlist.value.push(track)
  }

  // 从播放列表中移除
  const removeFromPlaylist = (trackId: string) => {
    const index = playlist.value.findIndex(t => t.id === trackId)
    if (index !== -1) {
      playlist.value.splice(index, 1)
    }
  }

  // 切换播放模式
  const togglePlayMode = () => {
    playMode.value = (playMode.value + 1) % 3
  }

  // 获取播放模式信息
  const playModeInfo = computed(() => {
    const modes = [
      { name: '列表循环', icon: 'RepeatOutline', active: playMode.value === 0 },
      { name: '单曲循环', icon: 'RepeatOneOutline', active: playMode.value === 1 },
      { name: '随机播放', icon: 'ShuffleOutline', active: playMode.value === 2 }
    ]
    return modes[playMode.value]
  })

  // 兼容性属性（为了兼容现有代码）
  const isRepeating = computed(() => playMode.value === 0 || playMode.value === 1)
  const isShuffling = computed(() => playMode.value === 2)

  // 监听音量变化
  watchEffect(() => {
    if (sound.value) {
      sound.value.volume(volume.value / 100)
    }
  })

  // 获取当前播放信息的计算属性
  const currentTrackInfo = computed(() => {
    if (!currentTrack.value) return null
    return {
      id: currentTrack.value.id,
      title: currentTrack.value.title,
      artist: currentTrack.value.artist || '未知艺术家',
      cover: currentTrack.value.cover,
      href: currentTrack.value.href,
      duration_ms: currentTrack.value.duration_ms,
      external_url: currentTrack.value.external_url,
      web_url: currentTrack.value.web_url,
      album_name: currentTrack.value.album_name,
      release_date: currentTrack.value.release_date,
      explicit: currentTrack.value.explicit,
      popularity: currentTrack.value.popularity,
      uri: currentTrack.value.uri,
      track_number: currentTrack.value.track_number,
      disc_number: currentTrack.value.disc_number,
      is_local: currentTrack.value.is_local,
      artist_id: currentTrack.value.artist_id,
      album_id: currentTrack.value.album_id
    }
  })

  return {
    // 状态
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    totalTime,
    progress,
    volume,
    isBackward,
    isForward,
    playMode,
    playModeInfo,
    isRepeating,
    isShuffling,
    currentTrackInfo,
    
    // 方法
    playTrack,
    playTrackByIndex,
    togglePlay,
    playPrevious,
    playNext,
    setProgress,
    startDraggingProgress,
    endDraggingProgress,
    setPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    togglePlayMode,
    // 兼容性方法（为了兼容现有代码）
    toggleRepeat: togglePlayMode,
    toggleShuffle: togglePlayMode
  }
} 