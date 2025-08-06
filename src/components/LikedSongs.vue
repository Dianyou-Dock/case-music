<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, defineEmits, computed } from 'vue'
import { NSpin, NGrid, NGridItem, NCard, NImage, NEmpty, useMessage, NText, NButton, NIcon, NSpace } from 'naive-ui'
import { PlayOutline, ListOutline, Heart, HeartOutline } from '@vicons/ionicons5'
import { invoke } from "@tauri-apps/api/core"
import useTheme from '../composables/useTheme'
import usePlayer from '../composables/usePlayer'
import usePlayQueue from '../composables/usePlayQueue'

const { themeColor, isDarkTheme } = useTheme()
const message = useMessage()
const loading = ref(false)
const initialLoading = ref(true)
const likedSongs = ref<any[]>([])

// 无限滚动相关
const pageSize = ref(50)
const hasMoreItems = ref(true)
const offset = ref(0)
const loadingMore = ref(false)
const totalItems = ref(0)

// 播放器
const { playTrack } = usePlayer()

// 播放队列
const { addMultipleToQueue, startQueue, playPriority, enableAutoAddMode, disableAutoAddMode, autoAddToQueue, playbackInfo } = usePlayQueue()

const emit = defineEmits(['play-track'])

// 滚动监听器引用
let scrollContainer: HTMLElement | null = null
let scrollDebounceTimer: number | null = null

// 简化的滚动处理函数
const handleScroll = () => {
  if (loadingMore.value || !hasMoreItems.value) {
    return
  }

  // 清除之前的防抖定时器
  if (scrollDebounceTimer) {
    clearTimeout(scrollDebounceTimer)
  }

  // 防抖处理
  scrollDebounceTimer = setTimeout(() => {
    let scrollTop, scrollHeight, clientHeight
    
    if (scrollContainer) {
      scrollTop = scrollContainer.scrollTop
      scrollHeight = scrollContainer.scrollHeight
      clientHeight = scrollContainer.clientHeight
    } else {
      // 备用：使用window滚动
      scrollTop = window.pageYOffset || document.documentElement.scrollTop
      scrollHeight = document.documentElement.scrollHeight
      clientHeight = window.innerHeight
    }
    
    const threshold = 1000 // 距离底部1000px时触发加载
    const distance = scrollHeight - (scrollTop + clientHeight)
    
    if (distance <= threshold) {
      fetchLikedSongs(false)
    }
  }, 50) as any
}

// 设置滚动监听器
const setupScrollListener = () => {
  // 先清理现有的监听器
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll)
    scrollContainer = null
  }
  
  // 移除可能存在的window监听器
  window.removeEventListener('scroll', handleScroll)
  
  // 策略1：查找songs-grid容器（真正的滚动容器）
  const songsGrid = document.querySelector('.songs-grid') as HTMLElement
  
  if (songsGrid) {
    // 添加容器滚动监听器
    scrollContainer = songsGrid
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return true
  } else {
    // 备用策略：查找main-content容器
    const mainContent = document.querySelector('.main-content') as HTMLElement
    
    if (mainContent) {
      scrollContainer = mainContent
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
      
      // 同时添加window滚动监听器作为备用
      window.addEventListener('scroll', handleScroll, { passive: true })
      return true
    } else {
      // 最后备用方案：只使用window滚动
      window.addEventListener('scroll', handleScroll, { passive: true })
      return true
    }
  }
}

const fetchLikedSongs = async (isInitial = false) => {
  if (isInitial) {
    initialLoading.value = true
    offset.value = 0
    likedSongs.value = []
    hasMoreItems.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await invoke('get_saved_tracks', {
      limit: pageSize.value,
      offset: offset.value,
      market: 'CN'
    }) as {
      success: boolean
      message: string
      tracks?: any[]
      total?: number
      limit?: number
      offset?: number
      next?: string
      previous?: string
    }

    if (response.success && response.tracks) {
      // 检查返回数据是否合理
      if (response.tracks.length === 0 && !isInitial) {
        hasMoreItems.value = false
        message.info('没有更多歌曲了')
        return
      }
      
      if (isInitial) {
        likedSongs.value = response.tracks
      } else {
        // 避免重复添加数据
        const existingIds = new Set(likedSongs.value.map(song => song.track.id))
        const newSongs = response.tracks.filter(song => !existingIds.has(song.track.id))
        
        if (newSongs.length === 0) {
          hasMoreItems.value = false
          message.warning('检测到重复数据，可能已到达末尾')
          return
        }
        
        likedSongs.value = [...likedSongs.value, ...newSongs]
      }

      if (response.total) {
        totalItems.value = response.total
      }

      // offset 应该基于后端返回的实际数量
      offset.value += response.tracks.length
      
      // 使用后端的 next 字段来判断是否还有更多数据
      if (response.next !== null && response.next !== undefined) {
        hasMoreItems.value = true
      } else if (offset.value >= totalItems.value) {
        hasMoreItems.value = false
      } else {
        hasMoreItems.value = offset.value < totalItems.value
      }

      // 如果是初始加载，数据加载完成后重新设置滚动监听器
      if (isInitial) {
        nextTick(() => {
          setupScrollListener()
        })
      }
    } else {
      message.error(response.message || '获取收藏歌曲失败')
      hasMoreItems.value = false
    }
  } catch (error: any) {
    message.error(`获取收藏歌曲出错: ${error.message || error}`)
    hasMoreItems.value = false
  } finally {
    initialLoading.value = false
    loadingMore.value = false
  }
}

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatArtists = (artists: any[]) => {
  return artists.map((artist: any) => artist.name).join(', ')
}

// 播放歌曲
const playLikedSong = async (trackId: string) => {
  try {
    const response = await invoke('get_track_details', {
      trackId,
      market: 'CN'
    }) as {
      success: boolean
      message: string
      track?: any
      playable_track?: {
        id: string
        title: string
        artist: string
        url?: string
        cover?: string
        duration_ms: number
        has_preview: boolean
        href: string
        external_url: string
        web_url: string
        album_name: string
        release_date: string
        explicit: boolean
        popularity: number
        uri: string
        track_number: number
        disc_number: number
        is_local: boolean
        artist_id: string
        album_id: string
        artists: any[]
        album: any
      }
    }

    if (response.success && response.playable_track) {
      if (response.playable_track.uri) {
        const trackInfo = {
          id: response.playable_track.id,
          name: response.playable_track.title,
          uri: response.playable_track.uri,
          artists: response.playable_track.artists || [{ name: response.playable_track.artist }],
          album: response.playable_track.album || {
            name: response.playable_track.album_name || '',
            images: response.playable_track.cover ? [{ url: response.playable_track.cover }] : []
          },
          duration_ms: response.playable_track.duration_ms
        }
        
        playPriority(response.playable_track.uri, trackInfo)
        emit('play-track', response.playable_track.uri)
        message.success(`正在优先播放: ${response.playable_track.title}`, {
          duration: 2000
        })
      } else {
        message.error('此歌曲没有可播放的URI', {
          duration: 3000
        })
      }
    } else {
      message.error(response.message || '获取歌曲详情失败', {
        duration: 3000
      })
    }
  } catch (error: any) {
    message.error(`播放歌曲出错: ${error.message || error}`, {
      duration: 3000
    })
  }
}

// 播放全部收藏歌曲
const playAllLikedSongs = async () => {
  if (totalItems.value === 0) {
    message.warning('没有收藏的歌曲')
    return
  }
  
  try {
    message.info('正在获取所有收藏歌曲...', { duration: 2000 })
    
    // 启用自动添加模式
    enableAutoAddMode('liked-songs-all')
    
    // 先获取第一页
    const firstPageResponse = await invoke('get_saved_tracks', {
      limit: 50,
      offset: 0,
      market: 'CN'
    }) as {
      success: boolean
      message: string
      tracks?: any[]
      total?: number
      next?: string | null
    }
    
    if (!firstPageResponse.success || !firstPageResponse.tracks) {
      message.error(firstPageResponse.message || '获取歌曲失败')
      disableAutoAddMode()
      return
    }
    
    // 将第一页歌曲添加到队列
    const firstPageTracks = firstPageResponse.tracks.map(item => ({
      id: item.track.id,
      name: item.track.name,
      uri: item.track.uri,
      artists: item.track.artists,
      album: item.track.album,
      duration_ms: item.track.duration_ms
    }))
    
    addMultipleToQueue(firstPageTracks)
    
    // 立即开始播放第一页
    const firstTrack = startQueue()
    if (firstTrack) {
      emit('play-track', firstTrack.uri)
      message.success(`开始播放，已加载 ${firstPageTracks.length} 首歌曲，正在后台获取剩余歌曲...`)
    }
    
    // 在后台继续获取剩余歌曲
    const totalSongs = firstPageResponse.total || totalItems.value
    if (totalSongs > firstPageTracks.length) {
      fetchRemainingAllTracks(50, totalSongs, firstPageTracks.length)
    } else {
      disableAutoAddMode()
    }
    
  } catch (error: any) {
    message.error(`获取歌曲出错: ${error.message || error}`)
    disableAutoAddMode()
  }
}

// 后台获取剩余的所有歌曲
const fetchRemainingAllTracks = async (currentOffset: number, totalSongs: number, loadedCount: number) => {
  try {
    const autoAddSource = 'liked-songs-all'
    while (loadedCount < totalSongs && playbackInfo.value.isAutoAddingMode && playbackInfo.value.autoAddSource === autoAddSource) {
      const response = await invoke('get_saved_tracks', {
        limit: 50,
        offset: currentOffset,
        market: 'CN'
      }) as {
        success: boolean
        message: string
        tracks?: any[]
        total?: number
        next?: string | null
      }
      
      if (!response.success || !response.tracks || response.tracks.length === 0) {
        break
      }
      
      // 将新歌曲添加到播放队列
      const newTracks = response.tracks.map(item => ({
        id: item.track.id,
        name: item.track.name,
        uri: item.track.uri,
        artists: item.track.artists,
        album: item.track.album,
        duration_ms: item.track.duration_ms
      }))
      
      const addedCount = autoAddToQueue(newTracks, autoAddSource)
      loadedCount += response.tracks.length
      currentOffset += response.tracks.length
      
      // 如果没有更多数据，跳出循环
      if (!response.next || response.tracks.length < 50) {
        break
      }
      
      // 延迟一下避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    if (playbackInfo.value.isAutoAddingMode && playbackInfo.value.autoAddSource === autoAddSource) {
      disableAutoAddMode()
      message.success(`所有 ${loadedCount} 首收藏歌曲已添加到播放队列`, { duration: 3000 })
    }
    
  } catch (error: any) {
    message.error(`后台获取歌曲出错: ${error.message || error}`)
    disableAutoAddMode()
  }
}

// 切换收藏状态
const toggleLike = async (track: any, event: Event) => {
  event.stopPropagation()
  
  try {
    if (track.liked !== false) {
      // 取消收藏
      const response = await invoke('remove_track_from_liked', {
        trackId: track.id
      }) as { success: boolean; message: string }
      
      if (response.success) {
        // 从列表中移除这首歌
        const index = likedSongs.value.findIndex(song => song.track.id === track.id)
        if (index !== -1) {
          likedSongs.value.splice(index, 1)
          totalItems.value = Math.max(0, totalItems.value - 1)
        }
        message.success('已取消收藏')
      } else {
        message.error(response.message || '取消收藏失败')
      }
    } else {
      // 添加收藏
      const response = await invoke('add_track_to_liked', {
        trackId: track.id
      }) as { success: boolean; message: string }
      
      if (response.success) {
        track.liked = true
        message.success('已添加到收藏')
      } else {
        message.error(response.message || '添加收藏失败')
      }
    }
  } catch (error: any) {
    message.error(`操作失败: ${error.message || error}`)
  }
}

onMounted(async () => {
  // 先获取初始数据
  await fetchLikedSongs(true)
  
  // 设置滚动监听器，带重试机制
  nextTick(() => {
    let retryCount = 0
    const maxRetries = 3
    
    const trySetupScroll = () => {
      const success = setupScrollListener()
      
      if (!success) {
        retryCount++
        if (retryCount < maxRetries) {
          setTimeout(trySetupScroll, 500)
        }
      }
    }
    
    trySetupScroll()
  })
})

onUnmounted(() => {
  // 清理防抖定时器
  if (scrollDebounceTimer) {
    clearTimeout(scrollDebounceTimer)
    scrollDebounceTimer = null
  }
  
  // 清理滚动监听器
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll)
  }
  
  // 清理window滚动监听器
  window.removeEventListener('scroll', handleScroll)
  
  // 停用自动添加模式（如果是从这个组件启动的）
  const autoAddSource = 'liked-songs-all'
  if (playbackInfo.value.isAutoAddingMode && playbackInfo.value.autoAddSource === autoAddSource) {
    disableAutoAddMode()
  }
})
</script>

<template>
  <div class="liked-songs-container">
    <div class="header">
      <div class="header-content">
        <div class="header-title">
          <h1 :style="{ color: themeColor }">收藏的歌曲</h1>
          <p class="song-count" v-if="totalItems > 0">{{ totalItems }} 首歌曲</p>
        </div>
        <div class="header-actions" v-if="likedSongs.length > 0">
          <n-space>
            <n-button 
              type="primary" 
              block 
              quaternary ghost round
              :color="themeColor"
              @click="playAllLikedSongs"
              size="large"
            >
              <template #icon>
                <n-icon><PlayOutline /></n-icon>
              </template>
              播放全部
            </n-button>
          </n-space>
        </div>
      </div>
    </div>
    
    <n-spin :show="initialLoading">
      <div v-if="likedSongs.length > 0" class="songs-grid">
        <n-grid :cols="6" :x-gap="12" :y-gap="12">
          <n-grid-item v-for="(item, index) in likedSongs" :key="index">
            <n-card
              class="song-card"
              :bordered="false"
              size="small"
              hoverable
              @click="playLikedSong(item.track.id)"
            >
              <template #cover>
                <n-image
                  v-if="item.track && item.track.album && item.track.album.images && Array.isArray(item.track.album.images) && item.track.album.images.length > 0"
                  :src="item.track.album.images[0].url"
                  object-fit="cover"
                  class="song-image"
                  :preview-disabled="true"
                />
                <div v-else class="no-image">
                  <span>无封面</span>
                </div>
              </template>
              
              <div class="song-info">
                <div class="song-header">
                  <div class="text-scroll-container">
                    <div class="text-marquee">
                      <p class="song-title">{{ item.track.name }}</p>
                    </div>
                  </div>
                  <n-button
                    quaternary
                    circle
                    size="small"
                    class="like-btn"
                    @click="toggleLike(item.track, $event)"
                  >
                    <n-icon size="16" :color="item.track.liked !== false ? '#ff4757' : '#888'">
                      <component :is="item.track.liked !== false ? Heart : HeartOutline" />
                    </n-icon>
                  </n-button>
                </div>
                <div class="text-scroll-container">
                  <div class="text-marquee">
                    <p class="song-artists">{{ formatArtists(item.track.artists) }}</p>
                  </div>
                </div>
                <div class="text-scroll-container">
                  <div class="text-marquee">
                    <p class="song-album">{{ item.track.album.name }}</p>
                  </div>
                </div>
                <p class="song-duration">{{ formatDuration(item.track.duration_ms) }}</p>
              </div>
            </n-card>
          </n-grid-item>
        </n-grid>
        
        <!-- 加载更多提示 -->
        <div v-if="loadingMore" class="loading-more">
          <n-spin size="small" />
          <span>加载更多...</span>
        </div>
        
        <!-- 已加载全部提示 -->
        <div v-if="!hasMoreItems && likedSongs.length > 0" class="all-loaded">
          <span>已加载全部歌曲</span>
        </div>
      </div>
      
      <n-empty v-else-if="!initialLoading" description="没有收藏的歌曲" />
    </n-spin>
  </div>
</template>

<style scoped>
.liked-songs-container {
  padding: 20px;
  height: 100%;
  max-height: 100vh; /* 限制最大高度为视口高度 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止容器本身溢出 */
}

.header {
  margin-bottom: 20px;
  flex-shrink: 0; /* 头部不要被压缩 */
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}

.header-title h1 {
  margin: 0 0 5px 0;
  color: v-bind(themeColor);
  font-size: 32px;
  font-weight: bold;
}

.song-count {
  color: v-bind(themeColor);
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

.header-actions {
  display: flex;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-title h1 {
    font-size: 24px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: center;
  }
}

.songs-grid {
  margin-top: 10px;
  flex: 1;
  min-height: 400px; /* 设置最小高度，确保有足够空间显示内容 */
  overflow-y: auto; /* 让歌曲网格区域可滚动 */
  max-height: calc(100vh - 200px); /* 预留头部和底部播放器的空间 */
}

.song-card {
  transition: all 0.3s ease;
  height: 100%;
  cursor: pointer;
  /* 优化渲染性能 */
  will-change: transform;
  transform: translateZ(0); /* 启用硬件加速 */
  backface-visibility: hidden; /* 隐藏元素背面，优化3D变换 */
}

.song-card:hover {
  transform: translateY(-3px);
}

/* 删除动画效果 */
.song-card.removing {
  opacity: 0;
  transform: scale(0.8) translateY(-20px);
  transition: all 0.3s ease;
}

.song-image {
  height: 100px;
  width: 100%;
  object-fit: cover;
}

.no-image {
  height: 100px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: v-bind("isDarkTheme ? '#282828' : '#e0e0e0'");
  color: v-bind(themeColor);
}

.song-info {
  padding: 6px 0;
}

.song-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.like-btn {
  flex-shrink: 0;
  padding: 2px !important;
  transition: transform 0.2s ease;
}

.like-btn:hover {
  transform: scale(1.1);
}

.text-scroll-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.text-marquee {
  display: inline-block;
  width: max-content;
}

.song-title, .song-artists, .song-album {
  margin: 0;
  white-space: nowrap;
  display: inline-block;
}

.text-scroll-container:hover .text-marquee {
  animation: marquee 3s linear infinite alternate;
}

.song-title {
  font-weight: bold;
  font-size: 14px;
}

.song-artists {
  font-size: 12px;
  color: v-bind("isDarkTheme ? '#aaaaaa' : '#666666'");
  margin: 3px 0;
}

.song-album {
  font-size: 12px;
  color: v-bind("isDarkTheme ? '#888888' : '#999999'");
  margin: 3px 0;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(var(--offset, -50%)));
  }
}

.song-duration {
  font-size: 11px;
  color: v-bind(themeColor);
  margin: 3px 0;
}

.loading-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px 0;
  gap: 10px;
  color: v-bind("isDarkTheme ? '#aaaaaa' : '#666666'");
}

.all-loaded {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px 0;
  gap: 10px;
  color: v-bind("isDarkTheme ? '#aaaaaa' : '#666666'");
}
</style> 