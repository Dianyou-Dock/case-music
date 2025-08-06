import { ref, computed } from 'vue'

interface Track {
  id: string
  name: string
  uri: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
  duration_ms: number
  liked?: boolean
}

interface QueueItem {
  track: Track
  addedAt: Date
}

// 播放队列状态
const queue = ref<QueueItem[]>([])
const currentIndex = ref(-1)
const isPlayingFromQueue = ref(false)
const priorityTrack = ref<string | null>(null) // 当前优先播放的曲目
const priorityTrackInfo = ref<Track | null>(null) // 优先播放曲目的详细信息
const isAutoAddingMode = ref(false) // 是否开启自动添加模式（播放全部模式）
const autoAddSource = ref<string>('') // 自动添加的来源标识

export default function usePlayQueue() {
  // 当前正在播放的曲目
  const currentTrack = computed(() => {
    if (priorityTrack.value) {
      // 如果有优先播放，返回优先播放的曲目信息
      return priorityTrackInfo.value || queue.value.find(item => item.track.uri === priorityTrack.value)?.track
    }
    if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
      return queue.value[currentIndex.value].track
    }
    return null
  })

  // 下一首曲目
  const nextTrack = computed(() => {
    if (priorityTrack.value) {
      // 如果有优先曲目，下一首是队列当前位置
      if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
        return queue.value[currentIndex.value].track
      }
      return null
    }
    const nextIndex = currentIndex.value + 1
    if (nextIndex < queue.value.length) {
      return queue.value[nextIndex].track
    }
    return null
  })

  // 上一首曲目
  const previousTrack = computed(() => {
    if (priorityTrack.value) {
      return null // 优先播放时不能上一首
    }
    const prevIndex = currentIndex.value - 1
    if (prevIndex >= 0) {
      return queue.value[prevIndex].track
    }
    return null
  })

  // 添加单首歌曲到队列
  const addToQueue = (track: Track) => {
    const existingIndex = queue.value.findIndex(item => item.track.id === track.id)
    if (existingIndex === -1) {
      queue.value.push({
        track,
        addedAt: new Date()
      })
    }
  }

  // 添加多首歌曲到队列
  const addMultipleToQueue = (tracks: Track[]) => {
    tracks.forEach(track => addToQueue(track))
  }

  // 清空队列
  const clearQueue = () => {
    queue.value = []
    currentIndex.value = -1
    isPlayingFromQueue.value = false
    priorityTrack.value = null
    priorityTrackInfo.value = null
    isAutoAddingMode.value = false
    autoAddSource.value = ''
  }

  // 从队列移除歌曲
  const removeFromQueue = (trackId: string) => {
    const index = queue.value.findIndex(item => item.track.id === trackId)
    if (index !== -1) {
      queue.value.splice(index, 1)
      // 调整当前索引
      if (index < currentIndex.value) {
        currentIndex.value--
      } else if (index === currentIndex.value) {
        // 如果删除的是当前播放的，保持索引不变（播放下一首）
        if (currentIndex.value >= queue.value.length) {
          currentIndex.value = queue.value.length - 1
        }
      }
    }
  }

  // 播放下一首
  const playNext = () => {
    if (priorityTrack.value) {
      // 优先曲目结束，回到队列的当前位置继续播放
      priorityTrack.value = null
      priorityTrackInfo.value = null
      isPlayingFromQueue.value = true
      // 返回队列中当前索引的歌曲
      if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
        return queue.value[currentIndex.value].track
      }
      return null
    }
    
    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
      isPlayingFromQueue.value = true
      return queue.value[currentIndex.value].track
    }
    return null
  }

  // 播放上一首
  const playPrevious = () => {
    if (priorityTrack.value) {
      return null // 优先播放时不能上一首
    }
    
    if (currentIndex.value > 0) {
      currentIndex.value--
      isPlayingFromQueue.value = true
      return currentTrack.value
    }
    return null
  }

  // 播放队列中的特定歌曲
  const playFromQueue = (trackId: string) => {
    const index = queue.value.findIndex(item => item.track.id === trackId)
    if (index !== -1) {
      currentIndex.value = index
      isPlayingFromQueue.value = true
      priorityTrack.value = null
      priorityTrackInfo.value = null
      return queue.value[index].track
    }
    return null
  }

  // 优先播放某首歌（不在队列中）
  const playPriority = (trackUri: string, trackInfo?: Track) => {
    priorityTrack.value = trackUri
    priorityTrackInfo.value = trackInfo || null
    isPlayingFromQueue.value = false
  }

  // 开始播放队列
  const startQueue = () => {
    if (queue.value.length > 0) {
      currentIndex.value = 0
      isPlayingFromQueue.value = true
      priorityTrack.value = null
      priorityTrackInfo.value = null
      return queue.value[0].track
    }
    return null
  }

  // 启用自动添加模式（播放全部）
  const enableAutoAddMode = (source: string = 'liked-songs') => {
    isAutoAddingMode.value = true
    autoAddSource.value = source
    console.log(`🎵 已启用自动添加模式，来源: ${source}`)
  }

  // 停用自动添加模式
  const disableAutoAddMode = () => {
    isAutoAddingMode.value = false
    autoAddSource.value = ''
    console.log('🛑 已停用自动添加模式')
  }

  // 自动添加歌曲（如果启用了自动添加模式）
  const autoAddToQueue = (tracks: Track[], source: string = 'liked-songs') => {
    if (isAutoAddingMode.value && autoAddSource.value === source) {
      const addedCount = tracks.filter(track => {
        const existingIndex = queue.value.findIndex(item => item.track.id === track.id)
        if (existingIndex === -1) {
          queue.value.push({
            track,
            addedAt: new Date()
          })
          return true
        }
        return false
      }).length
      
      if (addedCount > 0) {
        console.log(`✅ 自动添加了 ${addedCount} 首歌曲到播放队列`)
      }
      return addedCount
    }
    return 0
  }

  // 队列是否为空
  const isEmpty = computed(() => queue.value.length === 0)

  // 队列长度
  const queueLength = computed(() => queue.value.length)

  // 当前播放进度信息
  const playbackInfo = computed(() => ({
    currentIndex: currentIndex.value,
    total: queue.value.length,
    hasNext: nextTrack.value !== null,
    hasPrevious: previousTrack.value !== null,
    isPlayingPriority: priorityTrack.value !== null,
    isAutoAddingMode: isAutoAddingMode.value,
    autoAddSource: autoAddSource.value
  }))

  return {
    // 状态
    queue: computed(() => queue.value),
    currentTrack,
    nextTrack,
    previousTrack,
    currentIndex: computed(() => currentIndex.value),
    isPlayingFromQueue: computed(() => isPlayingFromQueue.value),
    isEmpty,
    queueLength,
    playbackInfo,
    
    // 方法
    addToQueue,
    addMultipleToQueue,
    clearQueue,
    removeFromQueue,
    playNext,
    playPrevious,
    playFromQueue,
    playPriority,
    startQueue,
    enableAutoAddMode,
    disableAutoAddMode,
    autoAddToQueue
  }
} 