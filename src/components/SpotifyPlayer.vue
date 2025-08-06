<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NCard, NSpin, NSlider, NButton, NIcon, NSpace, NText, NImage, NProgress, NPopover, NTag, NTooltip } from 'naive-ui'
import { PlayOutline, PauseOutline, PlaySkipBackOutline, PlaySkipForwardOutline, VolumeHighOutline, VolumeMediumOutline, VolumeOffOutline, ShuffleOutline, RepeatOutline, AlbumsOutline, Heart, HeartOutline, RefreshOutline } from '@vicons/ionicons5'
import useSpotifyWebPlayback from '../composables/useSpotifyWebPlayback'
import useTheme from '../composables/useTheme'
import usePlayQueue from '../composables/usePlayQueue'
import { useMessage } from 'naive-ui'
import { invoke } from "@tauri-apps/api/core"

const message = useMessage()
const { themeColor, isDarkTheme } = useTheme()

// 播放队列集成
const { 
  playNext: queuePlayNext,
  playPrevious: queuePlayPrevious,
  currentTrack: queueCurrentTrack,
  playbackInfo,
  playPriority,
  queue
} = usePlayQueue()

// 获取播放模式对应的图标组件
const getPlayModeIcon = () => {
  switch (playModeInfo.value.icon) {
    case 'RepeatOutline':
      return RepeatOutline
    case 'RepeatOneOutline':
      return RepeatOutline // 使用 RepeatOutline 代替单曲循环
    case 'ShuffleOutline':
      return ShuffleOutline
    default:
      return RepeatOutline
  }
}

const props = defineProps<{
  initialTrackUri?: string; // 初始播放的曲目URI
}>()

const {
  player,
  deviceId,
  isReady,
  isConnected,
  isPremium,
  error,
  currentState,
  currentTrack,
  isPlaying,
  position,
  duration,
  playModeInfo,
  play,
  togglePlay,
  pause,
  resume,
  next,
  previous,
  seek,
  setVolume,
  togglePlayMode,
  getCurrentState,
  startStateUpdates,
  stopStateUpdates,
  reinitializePlayer,
  forceResetPlayer,
  checkPremiumStatus,
  validateTokenScopes,
  refreshManualModeChange,
  resetManualModeChange,
  setShuffle,
} = useSpotifyWebPlayback()

// 音量控制
const volume = ref(50)
const isMuted = ref(false)
const previousVolume = ref(50)

// 滚轮控制音量
const handleVolumeWheel = (event: WheelEvent) => {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 2 : -2  // 向上滚动+2，向下滚动-2
  const newVolume = Math.max(0, Math.min(100, volume.value + delta))
  volume.value = newVolume
  setVolume(newVolume)
}

// 进度条值（百分比）
const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (position.value / duration.value) * 100
})

// 格式化时间
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 格式化当前播放时间
const formattedPosition = computed(() => {
  return formatTime(position.value)
})

// 格式化总时长
const formattedDuration = computed(() => {
  return formatTime(duration.value)
})

// 格式化艺术家名称
const artistNames = computed(() => {
  if (!currentTrack.value) return ''
  return currentTrack.value.artists.map(artist => artist.name).join(', ')
})

// 专辑封面
const albumCover = computed(() => {
  if (!currentTrack.value || !currentTrack.value.album.images.length) return null
  return currentTrack.value.album.images[0].url
})

// 获取音量图标
const getVolumeIcon = computed(() => {
  if (volume.value === 0) {
    return VolumeOffOutline
  } else if (volume.value > 0 && volume.value <= 50) {
    return VolumeMediumOutline
  } else {
    return VolumeHighOutline
  }
})

// 处理进度条拖拽
const isDraggingProgress = ref(false)
const dragProgress = ref(0)

const handleProgressDragStart = () => {
  isDraggingProgress.value = true
  dragProgress.value = progressPercent.value
}

const handleProgressDragEnd = () => {
  isDraggingProgress.value = false
  if (duration.value) {
    const seekPosition = (dragProgress.value / 100) * duration.value
    seek(seekPosition)
  }
  // 拖动进度条后延长播放模式保护期
  refreshManualModeChange()
}

const handleProgressChange = (value: number) => {
  dragProgress.value = value
}

// 滚轮控制音量时，对静音状态进行管理
watch(volume, (newVolume) => {
  if (newVolume > 0 && isMuted.value) {
    isMuted.value = false
  }
})

// 静音/取消静音
const toggleMute = () => {
  if (isMuted.value) {
    // 取消静音
    volume.value = previousVolume.value
    setVolume(previousVolume.value)
    isMuted.value = false
  } else {
    // 静音
    previousVolume.value = volume.value
    volume.value = 0
    setVolume(0)
    isMuted.value = true
  }
}

// 播放特定曲目
const playTrack = async (trackUri: string) => {
  try {
    await play(trackUri)
  } catch (err: any) {
    message.error(`播放失败: ${err.message}`)
  }
}

// 智能的前进后退函数，考虑播放模式和播放队列
const handleNext = async () => {
  // 单曲循环模式下，下一首还是当前歌曲
  if (playModeInfo.value.icon === 'RepeatOneOutline') {
    console.log('🔄 单曲循环模式，重新播放当前歌曲')
    if (currentTrack.value) {
      await playTrack(currentTrack.value.uri)
    }
    return
  }
  
  // 如果在播放队列模式下，优先使用队列
  if (playbackInfo.value.isAutoAddingMode || queue.value.length > 0) {
    const nextTrack = queuePlayNext()
    if (nextTrack) {
      console.log('📜 播放队列中的下一首:', nextTrack.name)
      await playTrack(nextTrack.uri)
      return
    }
  }
  
  // 使用Spotify原生的下一首（考虑随机播放、列表循环等）
  console.log('🎵 使用Spotify原生下一首，当前播放模式:', playModeInfo.value.name)
  
  // 检查是否为随机播放模式，确保状态正确
  if (playModeInfo.value.icon === 'ShuffleOutline') {
    console.log('🔀 随机播放模式，确保随机播放状态正确')
    // 刷新手动模式标记，防止被覆盖
    refreshManualModeChange()
  }
  
  // 播放下一首
  await next()
}

const handlePrevious = async () => {
  // 单曲循环模式下，上一首还是当前歌曲
  if (playModeInfo.value.icon === 'RepeatOneOutline') {
    console.log('🔄 单曲循环模式，重新播放当前歌曲')
    if (currentTrack.value) {
      await playTrack(currentTrack.value.uri)
    }
    return
  }
  
  // 如果在播放队列模式下，优先使用队列
  if (playbackInfo.value.isAutoAddingMode || queue.value.length > 0) {
    const prevTrack = queuePlayPrevious()
    if (prevTrack) {
      console.log('📜 播放队列中的上一首:', prevTrack.name)
      await playTrack(prevTrack.uri)
      return
    }
  }
  
  // 使用Spotify原生的上一首
  console.log('🎵 使用Spotify原生上一首，当前播放模式:', playModeInfo.value.name)
  
  // 检查是否为随机播放模式，确保状态正确
  if (playModeInfo.value.icon === 'ShuffleOutline') {
    console.log('🔀 随机播放模式，确保随机播放状态正确')
    // 刷新手动模式标记，防止被覆盖
    refreshManualModeChange()
  }
  
  // 播放上一首
  await previous()
}


// 歌曲结束检测逻辑
let trackEndingTriggered = ref(false)
let currentTrackUri = ref<string | null>(null)

// 监听播放进度，检测歌曲即将结束
watch([() => position.value, () => duration.value, () => isPlaying.value], ([pos, dur, playing]) => {
  if (dur > 0 && pos > 0 && playing) {
    const remainingTime = dur - pos
    
    // 当剩余时间少于1秒且还未触发时
    if (remainingTime <= 1000 && !trackEndingTriggered.value) {
      trackEndingTriggered.value = true
      console.log('🎵 歌曲即将结束，当前播放模式:', playModeInfo.value.name)
      
      // 延迟1秒后处理歌曲结束
      setTimeout(async () => {
        console.log('⏰ 歌曲结束计时器触发')
        
        // 根据播放模式决定下一步操作
        if (playModeInfo.value.icon === 'RepeatOneOutline') {
          // 单曲循环模式：重复播放当前歌曲
          console.log('🔄 单曲循环模式，重新播放当前歌曲')
          if (currentTrack.value) {
            await playTrack(currentTrack.value.uri)
          }
        } else if (playbackInfo.value.isAutoAddingMode || queue.value.length > 0) {
          // 如果在播放队列模式下，优先使用队列
          const nextTrack = queuePlayNext()
          if (nextTrack) {
            console.log('▶️ 播放队列模式，播放队列中的下一首:', nextTrack.name)
            await playTrack(nextTrack.uri)
          } else {
            console.log('📝 队列中没有下一首歌曲，使用Spotify原生播放模式')
            
            // 检查是否为随机播放模式，确保状态正确
            if (playModeInfo.value.icon === 'ShuffleOutline') {
              console.log('🔀 随机播放模式，确保随机播放状态正确')
              // 刷新手动模式标记，防止被覆盖
              refreshManualModeChange()
              // 播放下一首
              await next()
            }
          }
        } else {
          // 非队列模式，让Spotify的播放模式生效
          console.log('🎵 使用Spotify原生播放模式:', playModeInfo.value.name)
          
          // 检查是否为随机播放模式，确保状态正确
          if (playModeInfo.value.icon === 'ShuffleOutline') {
            console.log('🔀 随机播放模式，确保随机播放状态正确')
            // 刷新手动模式标记，防止被覆盖
            refreshManualModeChange()
            // 播放下一首
            await next()
          }
          // 不进行任何操作，让Spotify自己处理下一首
        }
      }, 1000)
    }
  }
})

// 监听当前歌曲变化，重置结束触发标志
watch(() => currentTrack.value, (newTrack) => {
  if (newTrack && newTrack.uri) {
    // 如果歌曲切换了，重置结束触发标志
    if (currentTrackUri.value !== newTrack.uri) {
      currentTrackUri.value = newTrack.uri
      trackEndingTriggered.value = false
      console.log('🎼 歌曲切换，重置结束检测:', newTrack.name)
    }
    
    // 检查这首歌是否在队列中
    const queueTrack = queueCurrentTrack.value
    const isInQueue = queue.value.some((item: any) => item.track.uri === newTrack.uri)
    
    // 只有当歌曲不在队列中，且当前队列也没有在播放这首歌时，才标记为优先播放
    if (!isInQueue && queueTrack?.uri !== newTrack.uri) {
      console.log('检测到手动播放歌曲，标记为优先播放:', newTrack.name)
      playPriority(newTrack.uri)
    }
  }
})

// 监听初始曲目变化
watch(() => props.initialTrackUri, (newUri) => {
  if (newUri && isReady.value) {
    playTrack(newUri)
  }
}, { immediate: true })

// 监听错误
watch(error, (newError) => {
  if (newError) {
    message.error(newError)
  }
})

// 监听设备ID
watch(deviceId, (newDeviceId) => {
  if (newDeviceId && props.initialTrackUri) {
    playTrack(props.initialTrackUri)
  }
})

// 打开诊断工具
const openDiagnostic = () => {
  // 直接在当前窗口打开浏览器控制台查看详细日志
  console.log('🔧 Spotify 播放器诊断信息:')
  console.log('Premium 状态:', isPremium.value)
  console.log('连接状态:', isConnected.value)
  console.log('准备状态:', isReady.value)
  console.log('设备ID:', deviceId.value)
  console.log('播放器实例:', player.value)
  console.log('当前错误:', error.value)
  console.log('SDK状态:', {
    sdkLoaded: !!window.Spotify,
    sdkReady: window.SpotifyWebPlaybackSDKReady || false,
    webPlayerAvailable: !!(window.Spotify && window.Spotify.Player),
  })
  
  message.info('诊断信息已输出到浏览器控制台，请按F12查看Console标签')
  
  // 尝试重新初始化
  setTimeout(() => {
    console.log('🔄 尝试重新初始化播放器...')
    reinitializePlayer()
  }, 2000)
}

// 处理歌曲结束事件
const handleTrackEnding = async (event: CustomEvent) => {
  const { trackUri, trackName } = event.detail
  console.log('🎼 收到歌曲结束事件:', trackName, '当前播放模式:', playModeInfo.value.name)
  
  // 延迟1秒后处理歌曲结束
  setTimeout(async () => {
    // 根据播放模式决定下一步操作
    if (playModeInfo.value.icon === 'RepeatOneOutline') {
      // 单曲循环模式：重复播放当前歌曲
      console.log('🔄 单曲循环模式，重新播放当前歌曲')
      if (currentTrack.value) {
        await playTrack(currentTrack.value.uri)
      }
    } else if (playbackInfo.value.isAutoAddingMode || queue.value.length > 0) {
      // 如果在播放队列模式下，优先使用队列
      const nextTrack = queuePlayNext()
      if (nextTrack) {
        console.log('▶️ 播放队列模式，播放队列中的下一首:', nextTrack.name)
        await playTrack(nextTrack.uri)
      } else {
        console.log('📝 队列中没有下一首歌曲，使用Spotify原生播放模式')
        
        // 检查是否为随机播放模式，确保状态正确
        if (playModeInfo.value.icon === 'ShuffleOutline') {
          console.log('🔀 随机播放模式，确保随机播放状态正确')
          // 刷新手动模式标记，防止被覆盖
          refreshManualModeChange()
          // 播放下一首
          await next()
        }
      }
    } else {
      // 非队列模式，让Spotify的播放模式生效
      console.log('🎵 使用Spotify原生播放模式:', playModeInfo.value.name)
      
      // 检查是否为随机播放模式，确保状态正确
      if (playModeInfo.value.icon === 'ShuffleOutline') {
        console.log('🔀 随机播放模式，确保随机播放状态正确')
        // 刷新手动模式标记，防止被覆盖
        refreshManualModeChange()
        // 播放下一首
        await next()
      }
    }
  }, 1000)
}

// 组件挂载时启动状态更新
onMounted(() => {
  startStateUpdates()
  
  // 添加歌曲结束事件监听器
  window.addEventListener('spotify-track-ending', handleTrackEnding as unknown as EventListener)
})

// 组件卸载时清理监听器
onUnmounted(() => {
  window.removeEventListener('spotify-track-ending', handleTrackEnding as unknown as EventListener)
})

// 切换当前歌曲的收藏状态
const toggleCurrentTrackLike = async () => {
  if (!currentTrack.value?.id) return
  
  try {
    // 获取当前歌曲的详细信息以获取liked状态
    const response = await invoke('get_track_details', {
      trackId: currentTrack.value.id,
      market: 'CN'
    }) as {
      success: boolean
      track?: { liked: boolean }
    }
    
    if (response.success && response.track) {
      if (response.track.liked) {
        // 取消收藏
        const likeResponse = await invoke('remove_track_from_liked', {
          trackId: currentTrack.value.id
        }) as { success: boolean; message: string }
        
        if (likeResponse.success) {
          message.success('已取消收藏')
        } else {
          message.error(likeResponse.message || '取消收藏失败')
        }
      } else {
        // 添加收藏
        const likeResponse = await invoke('add_track_to_liked', {
          trackId: currentTrack.value.id
        }) as { success: boolean; message: string }
        
        if (likeResponse.success) {
          message.success('已添加到收藏')
        } else {
          message.error(likeResponse.message || '添加收藏失败')
        }
      }
    }
  } catch (error: any) {
    message.error(`操作失败: ${error.message || error}`)
  }
}

// 获取当前歌曲的收藏状态
const currentTrackLiked = ref(false)
const checkCurrentTrackLiked = async () => {
  if (!currentTrack.value?.id) {
    currentTrackLiked.value = false
    return
  }
  
  try {
    const response = await invoke('get_track_details', {
      trackId: currentTrack.value.id,
      market: 'CN'
    }) as {
      success: boolean
      track?: { liked: boolean }
    }
    
    if (response.success && response.track) {
      currentTrackLiked.value = response.track.liked
    }
  } catch (error) {
    console.warn('检查收藏状态失败:', error)
  }
}

// 监听当前歌曲变化，更新收藏状态
watch(() => currentTrack.value?.id, () => {
  checkCurrentTrackLiked()
})


</script>

<template>
  <div class="spotify-player">
    <n-card :bordered="false" class="player-card" :style="{ backgroundColor: isDarkTheme ? '#1A1A1A' : '#F0F0F0' }">
      <n-spin :show="!isReady && !error">
        <div v-if="isReady" class="player-content">
          <!-- 当前播放歌曲信息 -->
          <div class="track-info">
            <div class="cover-container">
              <n-image
                v-if="albumCover"
                :src="albumCover"
                :width="56"
                :height="56"
                preview-disabled
                object-fit="cover"
                class="album-cover"
              />
              <div v-else class="no-cover">
                <n-icon size="30"><AlbumsOutline /></n-icon>
              </div>
            </div>
            
            <div class="track-details">
              <div class="track-header">
                <div class="track-text">
                  <div class="track-title" :title="currentTrack?.name">{{ currentTrack?.name || '未播放' }}</div>
                  <div class="track-artist" :title="artistNames">{{ artistNames || '未知艺术家' }}</div>
                </div>
                <n-button
                  v-if="currentTrack"
                  quaternary
                  circle
                  size="small"
                  class="player-like-btn"
                  @click="toggleCurrentTrackLike"
                >
                  <n-icon size="18" :color="currentTrackLiked ? '#ff4757' : '#888'">
                    <component :is="currentTrackLiked ? Heart : HeartOutline" />
                  </n-icon>
                </n-button>
              </div>
              <!-- 显示队列状态 -->
              <div v-if="playbackInfo.isPlayingPriority" class="queue-status priority">
                优先播放
              </div>
              <div v-else-if="playbackInfo.total > 0" class="queue-status queue">
                队列: {{ playbackInfo.currentIndex + 1 }} / {{ playbackInfo.total }}
              </div>
            </div>
          </div>
          
          <!-- 播放控制按钮 -->
          <div class="control-buttons">
            <n-button 
              quaternary 
              circle 
              :color="themeColor"
              @click="handlePrevious"
              :disabled="!playbackInfo.hasPrevious && !playbackInfo.isPlayingPriority"
              class="control-btn"
            >
              <n-icon :color="themeColor"><PlaySkipBackOutline /></n-icon>
            </n-button>
            
            <n-button quaternary circle class="play-button" :color="themeColor" @click="togglePlay">
              <n-icon :color="themeColor" class="play-icon">
                <component :is="isPlaying ? PauseOutline : PlayOutline" />
              </n-icon>
            </n-button>
            
            <n-button 
              quaternary 
              circle 
              :color="themeColor"
              @click="handleNext"
              :disabled="!playbackInfo.hasNext && !playbackInfo.isPlayingPriority"
              class="control-btn"
            >
              <n-icon :color="themeColor"><PlaySkipForwardOutline /></n-icon>
            </n-button>
            
            <!-- 播放模式按钮 -->
            <div class="playback-modes">
              <n-tooltip trigger="hover" placement="top">
                <template #trigger>
                  <n-button quaternary circle :class="['mode-btn', { active: playModeInfo.active }]" @click="togglePlayMode">
                    <div class="mode-icon-container">
                      <n-icon size="18" :color="playModeInfo.active ? themeColor : '#888'">
                        <component :is="getPlayModeIcon()" />
                      </n-icon>
                      <!-- 单曲循环模式显示数字1 -->
                      <span v-if="playModeInfo.icon === 'RepeatOneOutline'" class="mode-indicator" :style="{ color: playModeInfo.active ? themeColor : '#888' }">1</span>
                    </div>
                  </n-button>
                </template>
                {{ playModeInfo.name }}
              </n-tooltip>
              
              <!-- 添加重置播放模式按钮 -->
              <n-tooltip trigger="hover" placement="top" v-if="false"> <!-- 默认隐藏，需要时可以设置为true -->
                <template #trigger>
                  <n-button quaternary circle class="mode-btn" @click="resetManualModeChange">
                    <n-icon size="18" color="#888">
                      <RefreshOutline />
                    </n-icon>
                  </n-button>
                </template>
                重置播放模式
              </n-tooltip>
            </div>
            
            <!-- 音量按钮 -->
            <n-button 
              quaternary 
              circle 
              :color="themeColor" 
              class="control-btn volume-btn"
              @click="toggleMute"
              @wheel="handleVolumeWheel"
            >
              <div class="volume-container">
                <n-icon :color="isMuted ? '#ff4757' : themeColor">
                  <component :is="getVolumeIcon" />
                </n-icon>
                <span class="volume-indicator" :style="{ color: themeColor }">{{ volume }}</span>
              </div>
            </n-button>
          </div>
          
          <!-- 进度条 -->
          <div class="progress-container">
            <span class="time" :style="{ color: themeColor }">{{ formattedPosition }}</span>
            <n-slider
              :value="isDraggingProgress ? dragProgress : progressPercent"
              @update:value="handleProgressChange"
              @mousedown="handleProgressDragStart"
              @mouseup="handleProgressDragEnd"
              @touchstart="handleProgressDragStart"
              @touchend="handleProgressDragEnd"
              :color="themeColor"
              class="progress-slider custom-slider"
              :style="{ width: '100%' }"
            />
            <span class="time" :style="{ color: themeColor }">{{ formattedDuration }}</span>
          </div>
        </div>
        
        <div v-else-if="error" class="error-message">
          <n-text type="error">{{ error }}</n-text>
          <div class="error-actions">
            <n-button 
              v-if="error.includes('Premium') || error.includes('账户')" 
              @click="checkPremiumStatus"
              type="info"
              quaternary ghost round
              size="medium"
              style="margin-top: 8px;"
            >
              重新检查会员状态
            </n-button>
            <n-button 
              v-if="error.includes('权限') || error.includes('scope') || error.includes('Token')" 
              @click="validateTokenScopes"
              type="warning"
              quaternary ghost round
              size="medium"
              style="margin-top: 8px; margin-left: 4px;"
            >
              检查权限
            </n-button>
            <n-button 
              @click="reinitializePlayer"
              type="primary"
              quaternary ghost round
              size="medium"
              style="margin-top: 8px; margin-left: 4px;"
            >
              重新连接
            </n-button>
          </div>
          <n-text v-if="!isPremium" type="warning" style="margin-top: 12px; display: block;">
            如果您已经是 Premium 用户，请点击"重新检查会员状态"按钮。
          </n-text>
        </div>
        
        <div v-else class="loading-message">
          <n-spin size="large" />
          <n-text style="margin-top: 12px; display: block;">正在连接到Spotify...</n-text>
          <n-text depth="3" style="margin-top: 8px; display: block; font-size: 12px;">
            如果长时间卡在此页面，请检查浏览器控制台或点击下方按钮
          </n-text>
          <n-space style="margin-top: 16px;">
            <n-button @click="openDiagnostic" type="info" quaternary ghost round size="medium">
              诊断问题
            </n-button>
            <n-button @click="forceResetPlayer" type="warning" quaternary ghost round size="medium">
              强制重置
            </n-button>
            <n-button @click="reinitializePlayer" type="primary" quaternary ghost round size="medium">
              重试连接
            </n-button>
          </n-space>
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<style scoped>
.spotify-player {
  width: 100%;
  margin: 0;
  min-height: 4.5rem;
  background: inherit;
}

.player-card {
  border-radius: 0;
  border: none;
  box-shadow: 0 -0.125rem 0.5rem rgba(0, 0, 0, 0.1);
  margin: 0;
  height: 100%;
}

.player-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  min-height: 4.5rem;
  height: 100%;
}

.track-info {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  width: 14rem;
  min-width: 0;
}

.cover-container {
  margin-right: 1rem;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.5rem;
}

.album-cover {
  border-radius: 0.5rem;
  transition: transform 0.2s ease;
  width: 3.5rem !important;
  height: 3.5rem !important;
  display: block;
}

.album-cover :deep(img) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

.album-cover:hover {
  transform: scale(1.05);
}

.no-cover {
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, v-bind("isDarkTheme ? '#444' : '#e8e8e8'"), v-bind("isDarkTheme ? '#222' : '#d0d0d0'"));
  border-radius: 0.5rem;
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.15);
}

.track-details {
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.track-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.track-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.track-title {
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: v-bind("isDarkTheme ? '#ffffff' : '#1a1a1a'");
  margin-bottom: 0.125rem;
}

.track-artist {
  font-size: 0.75rem;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: v-bind("isDarkTheme ? '#b3b3b3' : '#666666'");
}

.player-like-btn {
  flex-shrink: 0;
  padding: 2px !important;
  transition: transform 0.2s ease;
}

.player-like-btn:hover {
  transform: scale(1.1);
}

.queue-status {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  margin-top: 0.125rem;
  display: inline-block;
}

.queue-status.priority {
  background-color: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.queue-status.queue {
  background-color: v-bind("isDarkTheme ? 'rgba(29, 185, 84, 0.2)' : 'rgba(0, 122, 255, 0.2)'");
  color: v-bind(themeColor);
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0 0.5rem;
}

.control-buttons .n-button {
  transition: all 0.2s ease;
  width: 2.25rem;
  height: 2.25rem;
}

.control-buttons .n-button:hover {
  transform: scale(1.1);
}

.control-btn .n-icon {
  font-size: 1.25rem !important;
  color: v-bind(themeColor) !important;
}

.play-button {
  transform: scale(1.1);
  width: 2.75rem !important;
  height: 2.75rem !important;
}

.play-button:hover {
  transform: scale(1.2);
}

.mode-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.mode-btn.active {
  opacity: 1;
}

.mode-icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-indicator {
  position: absolute;
  right: -3px;
  bottom: -3px;
  font-size: 8px;
  font-weight: bold;
  line-height: 1;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 10px;
  height: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.play-icon {
  font-size: 1.5rem !important;
  color: v-bind(themeColor) !important;
}

.progress-container {
  display: flex;
  align-items: center;
  flex: 2;
  gap: 0.5rem;
  min-width: 15rem;
  padding: 0 0.5rem;
  /* 调试样式 - 确保容器可见 */
  /* border: 1px solid red; */
}

.time {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  min-width: 2.5rem;
  text-align: center;
  color: v-bind(themeColor);
  font-weight: 600;
  letter-spacing: 0.025em;
  flex-shrink: 0;
}

.progress-slider {
  flex: 1;
  min-width: 8rem;
  height: 2rem;
  display: flex;
  align-items: center;
}

/* 音量容器样式 */
.volume-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1px;
}

.volume-indicator {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  color: v-bind(themeColor);
  opacity: 0.8;
  z-index: 10;
}

.volume-btn .n-icon {
  font-size: 1.25rem !important;
  color: v-bind(themeColor) !important;
}

.error-message, .loading-message {
  text-align: center;
  padding: 1.25rem;
}

.error-actions {
  margin-top: 0.75rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .player-content {
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    min-height: auto;
  }
  
  .track-info {
    width: 100%;
    min-width: unset;
    max-width: 100%;
    justify-content: center;
  }
  
  .control-buttons {
    justify-content: center;
    padding: 0;
  }
  
  .progress-container {
    width: 100%;
    min-width: unset;
    max-width: 100%;
    padding: 0 1rem;
  }
  

  
  .time {
    min-width: 2rem;
    font-size: 0.625rem;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .track-info {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
  
  .cover-container {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
  
  .album-cover, .no-cover {
    width: 3rem !important;
    height: 3rem !important;
  }
  
  .track-title {
    font-size: 0.75rem;
  }
  
  .track-artist {
    font-size: 0.625rem;
  }
  
  .progress-container {
    padding: 0 0.5rem;
  }
  
  .control-buttons {
    gap: 0.5rem;
  }
  
  .control-buttons .n-button {
    width: 2rem;
    height: 2rem;
  }
  
  .play-button {
    width: 2.5rem !important;
    height: 2.5rem !important;
  }
  

}
/* 确保根元素响应缩放 */
:root {
  font-size: 16px;
}

/* 调整naive-ui组件的默认样式以支持缩放 */
.custom-slider {
  width: 100%;
}

.custom-slider :deep(.n-slider) {
  height: 0.375rem;
  width: 100%;
}

.custom-slider :deep(.n-slider-rail) {
  height: 0.375rem;
  background-color: v-bind("isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'");
}

.custom-slider :deep(.n-slider-rail__fill) {
  height: 0.375rem;
  background-color: v-bind(themeColor) !important;
}

.custom-slider :deep(.n-slider-handle) {
  width: 0;
  height: 0;
  margin-top: 0;
  box-shadow: none;
  background-color: transparent !important;
  border: none !important;
  opacity: 0;
}

.custom-slider :deep(.n-slider-handle:hover) {
  box-shadow: none;
}

.custom-slider :deep(.n-slider-handle-indicator) {
  display: none;
}

:deep(.n-button) {
  font-size: inherit;
}
</style> 