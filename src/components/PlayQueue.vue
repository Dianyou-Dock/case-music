<script setup lang="ts">
import { ref, computed, defineEmits } from 'vue'
import { NCard, NList, NListItem, NText, NImage, NButton, NIcon, NSpace, NSpin, NEmpty, NPopconfirm, NTag } from 'naive-ui'
import { PlayOutline, TrashOutline, PlaySkipForwardOutline, ShuffleOutline, CloseOutline, AlbumsOutline } from '@vicons/ionicons5'
import usePlayQueue from '../composables/usePlayQueue'
import useTheme from '../composables/useTheme'

const { themeColor, isDarkTheme } = useTheme()
const { 
  queue, 
  currentIndex, 
  currentTrack,
  nextTrack,
  playbackInfo, 
  isEmpty, 
  queueLength,
  removeFromQueue,
  clearQueue,
  playFromQueue,
  startQueue,
  disableAutoAddMode
} = usePlayQueue()

const emit = defineEmits(['play-track'])

// 格式化时长
const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 格式化艺术家
const formatArtists = (artists: any[]) => {
  return artists.map(artist => artist.name).join(', ')
}

// 播放特定歌曲
const playTrack = (trackId: string) => {
  const track = playFromQueue(trackId)
  if (track) {
    emit('play-track', track.uri)
  }
}

// 开始播放队列
const playQueue = () => {
  const track = startQueue()
  if (track) {
    emit('play-track', track.uri)
  }
}

// 移除歌曲
const removeTrack = (trackId: string) => {
  removeFromQueue(trackId)
}

// 清空队列
const clearAll = () => {
  clearQueue()
}

// 判断是否为当前播放的歌曲
const isCurrentTrack = (index: number) => {
  // 如果有优先播放，队列中的歌曲都不显示为当前播放
  if (playbackInfo.value.isPlayingPriority) {
    return false
  }
  return index === currentIndex.value
}

// 获取专辑封面
const getAlbumCover = (track: any) => {
  if (track.album && track.album.images && track.album.images.length > 0) {
    return track.album.images[track.album.images.length - 1].url // 选择最小的封面
  }
  return null
}
</script>

<template>
  <div class="play-queue">
    <n-card :bordered="false">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>播放队列 ({{ queueLength }})</span>
          <n-tag 
            v-if="playbackInfo.isAutoAddingMode" 
            :color="{ color: '#52c41a', textColor: 'white' }" 
            size="tiny"
          >
            {{ playbackInfo.autoAddSource === 'liked-songs-all' ? '播放全部中' : '自动添加中' }}
          </n-tag>
        </div>
      </template>
              <template #header-extra>
        <n-space>
          <n-button 
            v-if="!isEmpty"
            type="primary" 
            quaternary ghost round
            size="medium"
            :color="themeColor"
            @click="playQueue"
          >
            <template #icon>
              <n-icon><PlayOutline /></n-icon>
            </template>
            播放队列
          </n-button>
          
          <n-button 
            v-if="playbackInfo.isAutoAddingMode"
            type="warning" 
            quaternary ghost round
            size="medium"
            @click="disableAutoAddMode"
          >
            <template #icon>
              <n-icon><CloseOutline /></n-icon>
            </template>
            {{ playbackInfo.autoAddSource === 'liked-songs-all' ? '停止播放全部' : '停止自动添加' }}
          </n-button>
          
          <n-popconfirm
            v-if="!isEmpty"
            @positive-click="clearAll"
            positive-text="确定"
            negative-text="取消"
          >
            <template #trigger>
              <n-button type="error" quaternary ghost round size="medium">
                <template #icon>
                  <n-icon><TrashOutline /></n-icon>
                </template>
                清空
              </n-button>
            </template>
            确定要清空播放队列吗？
          </n-popconfirm>
        </n-space>
      </template>

      <!-- 优先播放区域 -->
      <div v-if="playbackInfo.isPlayingPriority && currentTrack" class="priority-section" style="margin-bottom: 16px;">
        <div class="priority-header">
          <h3 :style="{ color: themeColor, margin: 0, fontSize: '16px' }">正在优先播放</h3>
        </div>
        
        <!-- 当前优先播放 -->
        <div class="priority-current" style="background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0.05) 100%); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <n-image
              v-if="getAlbumCover(currentTrack)"
              :src="getAlbumCover(currentTrack)"
              width="50"
              height="50"
              object-fit="cover"
              style="border-radius: 6px;"
            />
            <div v-else style="width: 50px; height: 50px; background: linear-gradient(135deg, #ffc107, #ff8c00); border-radius: 6px; display: flex; align-items: center; justify-content: center;">
              <n-icon size="24" color="white"><AlbumsOutline /></n-icon>
            </div>
            
            <div style="flex: 1;">
              <n-text style="font-weight: 600; font-size: 14px; color: #ffc107;">
                {{ currentTrack.name }}
              </n-text>
              <br>
              <n-text depth="2" style="font-size: 12px;">
                {{ formatArtists(currentTrack.artists) }}
              </n-text>
            </div>
            
            <n-text style="font-size: 11px; color: #ffc107; font-weight: 600;">
              优先播放中
            </n-text>
          </div>
        </div>
        
        <!-- 下一首预览 -->
        <div v-if="nextTrack" :style="{ background: isDarkTheme ? 'rgba(29, 185, 84, 0.1)' : 'rgba(29, 185, 84, 0.05)', borderRadius: '8px', padding: '10px' }">
          <div style="display: flex; align-items: center; gap: 10px;">
            <n-image
              v-if="nextTrack && getAlbumCover(nextTrack)"
              :src="getAlbumCover(nextTrack)"
              width="40"
              height="40"
              object-fit="cover"
              style="border-radius: 4px; opacity: 0.8;"
            />
            <div v-else style="width: 40px; height: 40px; background: linear-gradient(135deg, #1db954, #0d7a2e); border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.8;">
              <n-icon size="20" color="white"><AlbumsOutline /></n-icon>
            </div>
            
            <div style="flex: 1;">
              <n-text style="font-size: 12px; opacity: 0.9;" :style="{ color: themeColor }">
                下一首: {{ nextTrack?.name }}
              </n-text>
              <br>
              <n-text depth="3" style="font-size: 11px;">
                {{ nextTrack ? formatArtists(nextTrack.artists) : '' }}
              </n-text>
            </div>
          </div>
        </div>
      </div>

      <!-- 普通队列状态信息 -->
      <div v-else-if="!isEmpty" class="queue-info" style="margin-bottom: 16px;">
        <n-space>
          <n-tag :color="{ color: themeColor, textColor: 'white' }" size="small">
            当前: {{ currentIndex + 1 }} / {{ queueLength }}
          </n-tag>
          
          <!-- 自动添加模式状态 -->
          <n-tag 
            v-if="playbackInfo.isAutoAddingMode" 
            :color="{ color: '#52c41a', textColor: 'white' }" 
            size="small"
          >
            {{ playbackInfo.autoAddSource === 'liked-songs-all' ? '播放全部模式已开启' : '自动添加模式已开启' }}
          </n-tag>
        </n-space>
      </div>

      <!-- 空队列状态 -->
      <n-empty v-if="isEmpty" description="播放队列为空">
        <template #extra>
          <n-text depth="3">
            您可以从收藏歌曲或歌单中添加歌曲到播放队列
          </n-text>
        </template>
      </n-empty>

      <!-- 队列列表 -->
      <n-list v-else bordered>
        <n-list-item
          v-for="(item, index) in queue"
          :key="item.track.id"
          :class="{ 'current-track': isCurrentTrack(index) }"
          style="cursor: pointer;"
        >
          <template #prefix>
            <div class="track-cover">
              <n-image
                v-if="getAlbumCover(item.track)"
                :src="getAlbumCover(item.track)"
                width="40"
                height="40"
                object-fit="cover"
                style="border-radius: 4px;"
              />
              <div 
                v-else 
                style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center;"
              >
                <n-icon size="20" color="#ccc"><AlbumsOutline /></n-icon>
              </div>
            </div>
          </template>

          <div class="track-info" @click="playTrack(item.track.id)">
            <div class="track-main">
              <n-text 
                :style="{ 
                  fontWeight: isCurrentTrack(index) ? 'bold' : 'normal',
                  color: isCurrentTrack(index) ? themeColor : undefined
                }"
              >
                {{ item.track.name }}
              </n-text>
              <n-text depth="3" style="font-size: 12px;">
                {{ formatArtists(item.track.artists) }}
              </n-text>
            </div>
          </div>

          <template #suffix>
            <div style="display: flex; align-items: center; gap: 4px;">
              <!-- 当前播放标识 -->
              <n-icon 
                v-if="isCurrentTrack(index)"
                :color="themeColor"
                size="18"
              >
                <PlayOutline />
              </n-icon>

              <!-- 播放按钮 -->
              <n-button 
                v-if="!isCurrentTrack(index)"
                size="tiny" 
                circle 
                quaternary ghost round
                @click.stop="playTrack(item.track.id)"
              >
                <template #icon>
                  <n-icon size="14"><PlayOutline /></n-icon>
                </template>
              </n-button>

              <!-- 删除按钮 -->
              <n-button 
                size="tiny" 
                circle 
                type="error"
                quaternary ghost round
                @click.stop="removeTrack(item.track.id)"
              >
                <template #icon>
                  <n-icon size="14"><CloseOutline /></n-icon>
                </template>
              </n-button>
            </div>
          </template>
        </n-list-item>
      </n-list>
    </n-card>
  </div>
</template>

<style scoped>
.play-queue {
  padding: 16px;
  height: 100%;
  overflow: auto;
}

.track-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  padding-left: 12px;
}

.track-main {
  flex: 1;
}

.track-cover {
  display: flex;
  align-items: center;
}

.current-track {
  background-color: rgba(24, 160, 88, 0.1);
}

/* 隐藏滚动条 */
.play-queue {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.play-queue::-webkit-scrollbar {
  display: none;
}
</style> 