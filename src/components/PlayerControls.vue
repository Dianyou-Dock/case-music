<template>
  <div class="player-controls" :style="{ backgroundColor }">
    <div class="control-section left">
      <div class="track-info" v-if="currentTrackInfo">
        <div class="track-text">
          <div class="song-title">
            <a 
              :href="currentTrackInfo.web_url || currentTrackInfo.external_url || `https://open.spotify.com/track/${currentTrackInfo.id}`" 
              target="_blank" 
              class="spotify-link" 
              v-if="currentTrackInfo.web_url || currentTrackInfo.external_url || currentTrackInfo.id"
            >
              {{ currentTrackInfo.title }}
            </a>
            <span v-else>{{ currentTrackInfo.title }}</span>
          </div>
          <div class="song-artist">{{ currentTrackInfo.artist }}</div>
        </div>
        <n-button
          quaternary
          circle
          size="small"
          class="controls-like-btn"
          @click="toggleCurrentTrackLike"
        >
          <n-icon size="18" :color="currentTrackLiked ? '#ff4757' : '#888'">
            <component :is="currentTrackLiked ? Heart : HeartOutline" />
          </n-icon>
        </n-button>
      </div>
    </div>
    
    <div class="control-section center">
      <div class="controls-center">
        <n-button quaternary circle class="control-btn" @click="playPrevious">
          <n-icon size="26" :color="themeColor"><PlaySkipBackOutline /></n-icon>
        </n-button>
        
        <n-button quaternary circle class="play-btn" @click="togglePlay">
          <n-icon size="38" :color="themeColor">
            <component :is="isPlaying ? PauseOutline : PlayOutline" />
          </n-icon>
        </n-button>
        
        <n-button quaternary circle class="control-btn" @click="playNext">
          <n-icon size="26" :color="themeColor"><PlaySkipForwardOutline /></n-icon>
        </n-button>
      </div>
      
      <div class="progress-container">
        <span class="time-display">{{ currentTime }}</span>
        <n-slider
          v-model:value="progress"
          class="progress-slider"
          @update:value="setProgress"
          :tooltip="false"
          @mousedown="startDraggingProgress"
          @mouseup="endDraggingProgress"
          @touchstart="startDraggingProgress"
          @touchend="endDraggingProgress"
        />
        <span class="time-display">{{ totalTime }}</span>
      </div>
    </div>
    
    <div class="control-section right">
      <div class="playback-modes">
        <n-tooltip trigger="hover" placement="top">
          <template #trigger>
            <n-button quaternary circle :class="['mode-btn', { active: playModeInfo.active }]" @click="togglePlayMode">
              <div class="mode-icon-container">
                <n-icon size="18" :color="playModeInfo.active ? themeColor : ''">
                  <component :is="getPlayModeIcon()" />
                </n-icon>
                <!-- 单曲循环模式显示数字1 -->
                <span v-if="playModeInfo.icon === 'RepeatOneOutline'" class="mode-indicator" :style="{ color: playModeInfo.active ? themeColor : '' }">1</span>
              </div>
            </n-button>
          </template>
          {{ playModeInfo.name }}
        </n-tooltip>
      </div>
      
      <div class="volume-control">
        <n-icon size="20" :color="themeColor" class="volume-icon"><VolumeHighOutline /></n-icon>
        <n-slider
          v-model:value="volume"
          class="volume-slider"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon, NSlider, NTooltip } from 'naive-ui'
import { PlaySkipBackOutline, PlayOutline, PauseOutline, PlaySkipForwardOutline, ShuffleOutline, RepeatOutline, VolumeHighOutline, Heart, HeartOutline } from '@vicons/ionicons5'
import usePlayer from '../composables/usePlayer'
import { ref, watch } from 'vue'
import { invoke } from "@tauri-apps/api/core"
import { useMessage } from 'naive-ui'

const message = useMessage()

const props = defineProps<{
  backgroundColor: string
  themeColor: string
}>()

const { 
  isPlaying, 
  currentTime, 
  totalTime, 
  progress, 
  volume, 
  currentTrackInfo,
  playModeInfo,
  togglePlay, 
  playPrevious, 
  playNext,
  setProgress,
  startDraggingProgress,
  endDraggingProgress,
  togglePlayMode
} = usePlayer()

// 获取播放模式对应的图标组件
const getPlayModeIcon = () => {
  switch (playModeInfo.value.icon) {
    case 'RepeatOutline':
      return RepeatOutline
    case 'RepeatOneOutline':
      return RepeatOutline // 使用普通的 RepeatOutline 作为基础图标，搭配数字 "1" 指示符
    case 'ShuffleOutline':
      return ShuffleOutline
    default:
      return RepeatOutline
  }
}

// 获取当前歌曲的收藏状态
const currentTrackLiked = ref(false)
const checkCurrentTrackLiked = async () => {
  if (!currentTrackInfo.value?.id) {
    currentTrackLiked.value = false
    return
  }
  
  try {
    const response = await invoke('get_track_details', {
      trackId: currentTrackInfo.value.id,
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

// 切换当前歌曲的收藏状态
const toggleCurrentTrackLike = async () => {
  if (!currentTrackInfo.value?.id) return
  
  try {
    if (currentTrackLiked.value) {
      // 取消收藏
      const response = await invoke('remove_track_from_liked', {
        trackId: currentTrackInfo.value.id
      }) as { success: boolean; message: string }
      
      if (response.success) {
        currentTrackLiked.value = false
        message.success('已取消收藏')
      } else {
        message.error(response.message || '取消收藏失败')
      }
    } else {
      // 添加收藏
      const response = await invoke('add_track_to_liked', {
        trackId: currentTrackInfo.value.id
      }) as { success: boolean; message: string }
      
      if (response.success) {
        currentTrackLiked.value = true
        message.success('已添加到收藏')
      } else {
        message.error(response.message || '添加收藏失败')
      }
    }
  } catch (error: any) {
    message.error(`操作失败: ${error.message || error}`)
  }
}

// 监听当前歌曲变化，更新收藏状态
watch(() => currentTrackInfo.value?.id, () => {
  checkCurrentTrackLiked()
})

// 当没有可用的预览时，打开Spotify链接
const openSpotifyLink = () => {
  if (currentTrackInfo.value?.web_url) {
    window.open(currentTrackInfo.value.web_url, '_blank')
  } else if (currentTrackInfo.value?.external_url) {
    window.open(currentTrackInfo.value.external_url, '_blank')
  } else if (currentTrackInfo.value?.id) {
    window.open(`https://open.spotify.com/track/${currentTrackInfo.value.id}`, '_blank')
  }
}
</script>

<style scoped>
.player-controls {
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.control-section {
  display: flex;
  align-items: center;
}

.left {
  width: 25%;
  justify-content: flex-start;
}

.center {
  width: 50%;
  flex-direction: column;
  justify-content: center;
}

.right {
  width: 25%;
  justify-content: flex-end;
  gap: 20px;
}

.controls-center {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.control-btn {
  margin: 0 4px;
}

.play-btn {
  margin: 0 12px;
  transition: transform 0.2s;
}

.play-btn:hover {
  transform: scale(1.1);
}

.progress-container {
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
}

.progress-slider {
  flex: 1;
  margin: 0 10px;
  cursor: pointer;
}

.time-display {
  font-size: 12px;
  opacity: 0.8;
  min-width: 36px;
}

.track-info {
  max-width: 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}

.track-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.controls-like-btn {
  flex-shrink: 0;
  padding: 2px !important;
  transition: transform 0.2s ease;
}

.controls-like-btn:hover {
  transform: scale(1.1);
}

.song-title {
  font-weight: bold;
  font-size: 14px;
}

.spotify-link {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}

.spotify-link:hover {
  color: #1DB954; /* Spotify绿色 */
  text-decoration: underline;
}

.song-artist {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.playback-modes {
  display: flex;
  gap: 6px;
}

.mode-btn {
  opacity: 0.6;
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
  right: -2px;
  bottom: -2px;
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

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
}

.volume-slider {
  width: 80px;
}

.volume-icon {
  opacity: 0.8;
}
</style> 