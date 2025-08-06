<script setup lang="ts">
import { ref, h, computed, onMounted } from "vue";
import { NLayout, NLayoutSider, NMenu, NIcon, NConfigProvider, NMessageProvider } from 'naive-ui'
import { HomeOutline, SettingsOutline, LogInOutline, SunnyOutline, MoonOutline, MusicalNoteOutline, ChatboxEllipsesOutline, HeartOutline, BugOutline, ListOutline } from '@vicons/ionicons5'
import { BrandSpotify, BrandLastfm, Fish } from '@vicons/tabler'
import SpotifyLogin from './components/SpotifyLogin.vue'
import LastfmLogin from './components/LastfmLogin.vue'
import AISettings from './components/AISettings.vue'
import useTheme from './composables/useTheme'
import MarkdownViewer from './components/MarkdownViewer.vue'
import introMd from './assets/intro.md?raw'
import SpotifyPlaylists from './components/SpotifyPlaylists.vue'
import SpotifySetting from './components/SpotifySetting.vue'
import LikedSongs from './components/LikedSongs.vue'

import { invoke } from "@tauri-apps/api/core"
import SpotifyPlayer from './components/SpotifyPlayer.vue'
import SpotifyDebug from './components/SpotifyDebug.vue'
import PlayQueue from './components/PlayQueue.vue'

const { themeRef, currentThemeOverrides, toggleTheme, themeColor, isDarkTheme } = useTheme()

const currentView = ref('home')
const isSpotifyLoggedIn = ref(false)
const currentTrackUri = ref<string>('')

// 检查Spotify登录状态
const checkSpotifyLogin = async () => {
  try {
    const config = await invoke('check_spotify_login') as any
    if (config && config.client_id && config.client_secret && 
        config.redirect_uri && config.username) {
      isSpotifyLoggedIn.value = true
    } else {
      isSpotifyLoggedIn.value = false
    }
  } catch (error) {
    console.error('检查Spotify登录状态失败:', error)
    isSpotifyLoggedIn.value = false
  }
}

onMounted(() => {
  checkSpotifyLogin()
})

// 更新SpotifyLogin组件的登录状态变化事件处理
const handleSpotifyLoginStatusChange = () => {
  checkSpotifyLogin()
}

const handleMenuClick = (key: string) => {
  if (key === 'login-spotify') {
    currentView.value = 'spotify-login'
  } else if (key === 'login-lastfm') {
    currentView.value = 'lastfm-login'
  } else if (key === 'ai') {
    currentView.value = 'ai-settings'
  } else if (key === 'spotify-setting') {
    currentView.value = 'spotify-setting'
  } else if (key === 'spotify-debug') {
    currentView.value = 'spotify-debug'
  } else if (key === 'toggle-theme') {
    toggleTheme()
  } else if (key === 'spotify-playlists') {
    currentView.value = 'spotify-playlists'
  } else if (key === 'liked-songs') {
    currentView.value = 'liked-songs'
  } else if (key === 'play-queue') {
    currentView.value = 'play-queue'
  }
}



// 动态计算菜单选项
const menuOptions = computed(() => [
  {
    label: () => h('div', { style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center' } }, '首页'),
    key: 'home',
    icon: () => h(NIcon, { size: 24 }, { default: () => h(HomeOutline) }),
    children: [
      {
        label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, '摸鱼'),
        key: 'fish',
        icon: () => h(NIcon, { size: 24 }, { default: () => h(Fish) })
      },
      // 只有登录Spotify后才显示Spotify菜单项
      ...(isSpotifyLoggedIn.value ? [
        {
          label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, 'Spotify'),
          key: 'spotify',
          icon: () => h(NIcon, { size: 24 }, { default: () => h(BrandSpotify) }),
          children: [
            {
              label: () => h('div', { style: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center' } }, '所有歌单'),
              key: 'spotify-playlists',
              icon: () => h(NIcon, { size: 20 }, { default: () => h(MusicalNoteOutline) })
            },
            {
              label: () => h('div', { style: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center' } }, '收藏歌曲'),
              key: 'liked-songs',
              icon: () => h(NIcon, { size: 20 }, { default: () => h(HeartOutline) })
            },
            {
              label: () => h('div', { style: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center' } }, '播放队列'),
              key: 'play-queue',
              icon: () => h(NIcon, { size: 20 }, { default: () => h(ListOutline) })
            }
          ]
        }
      ] : [])
    ]
  },
  {
    label: () => h('div', { style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center' } }, '登录'),
    key: 'login',
    icon: () => h(NIcon, { size: 24 }, { default: () => h(LogInOutline) }),
    children: [
      {
        label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, 'Spotify'),
        key: 'login-spotify',
        icon: () => h(NIcon, { size: 24 }, { default: () => h(BrandSpotify) })
      },
      // {
      //   label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center'} }, 'Last.fm'),
      //   key: 'login-lastfm',
      //   icon: () => h(NIcon, { size: 24 }, { default: () => h(BrandLastfm) })
      // }
    ]
  },
  {
    label: () => h('div', { style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center' } }, '设置'),
    key: 'settings',
    icon: () => h(NIcon, { size: 24 }, { default: () => h(SettingsOutline) }),
    children: [
      {
        label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, isDarkTheme.value ? '切换亮色' : '切换暗色'),
        key: 'toggle-theme',
        icon: () => h(NIcon, { size: 24 }, { default: () => h(isDarkTheme.value ? SunnyOutline : MoonOutline) })
      },
      {
        label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, 'AI'),
        key: 'ai',
        icon: () => h(NIcon, { size: 24 }, { default: () => h(ChatboxEllipsesOutline) })
      },
      {
        label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, 'Spotify'),
        key: 'spotify-setting',
        icon: () => h(NIcon, { size: 24 }, { default: () => h(BrandSpotify) })
      },
      {
        label: () => h('div', { style: { fontSize: '15px', fontWeight: 'bold', textAlign: 'center' } }, 'Spotify调试'),
        key: 'spotify-debug',
        icon: () => h(NIcon, { size: 24 }, { default: () => h(BugOutline) })
      }
    ]
  }
])

// 播放Spotify曲目
const playSpotifyTrack = (uri: string) => {
  currentTrackUri.value = uri
}
</script>

<template>
  <n-config-provider :theme="themeRef" :theme-overrides="currentThemeOverrides" style="height: 100vh;">
    <n-message-provider>
      <n-layout has-sider style="height: 100%;">
        <n-layout-sider bordered :width="250">
          <h2 :style="{ color: themeColor, padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '50px' }">
            <n-icon size="45" :color="themeColor"><MusicalNoteOutline /></n-icon>
            CASE
          </h2>
          
          <n-menu
            :options="menuOptions"
            :root-indent="20"
            :indent="20"
            @update:value="handleMenuClick"
            :item-style="() => {
              return {
                borderRadius: '10px',
              }
            }"
          />
        </n-layout-sider>
        
        <n-layout style="height: 100%; display: flex; flex-direction: column;">
          
          <div class="main-content" :style="{ paddingBottom: isSpotifyLoggedIn ? '70px' : '0' }">
            <MarkdownViewer v-if="currentView === 'home'" :source="introMd" />
            <SpotifyLogin v-else-if="currentView === 'spotify-login'" @login-status-change="handleSpotifyLoginStatusChange" />
            <LastfmLogin v-else-if="currentView === 'lastfm-login'" />
            <AISettings v-else-if="currentView === 'ai-settings'" />
            <SpotifySetting v-else-if="currentView === 'spotify-setting'" />
            <SpotifyDebug v-else-if="currentView === 'spotify-debug'" />
            <SpotifyPlaylists v-else-if="currentView === 'spotify-playlists'" @play-track="playSpotifyTrack" />
            <LikedSongs v-else-if="currentView === 'liked-songs'" @play-track="playSpotifyTrack" />
            <PlayQueue v-else-if="currentView === 'play-queue'" @play-track="playSpotifyTrack" />
          </div>
          
        </n-layout>
        
        <!-- 底部固定播放器 - 只有登录 Spotify 后才显示 -->
        <div v-if="isSpotifyLoggedIn" class="bottom-player">
          <SpotifyPlayer :initialTrackUri="currentTrackUri" />
        </div>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
.main-content {
  flex: 1;
  width: 100%;
  overflow: auto;
  padding: 0;
  /* 隐藏滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  /* 优化滚动性能 */
  will-change: scroll-position;
  transform: translateZ(0); /* 启用硬件加速 */
  -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
}

.main-content::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

.bottom-player {
  position: fixed;
  bottom: 0;
  left: 250px; /* 从左侧菜单栏右边开始 */
  right: 0;
  z-index: 1000;
  /* 去掉边框，只保留缝隙 */
}

/* 响应式设计 */
@media (max-width: 768px) {
  .bottom-player {
    left: 0; /* 在移动设备上占满全宽 */
  }
}
</style>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
}

body {
  margin: 0;
  padding: 0;
}

button {
  border: none;
  outline: none;
  cursor: pointer;
}

/* 全局隐藏滚动条 */
* {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

*::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

/* 确保 Naive UI 组件也隐藏滚动条 */
.n-scrollbar-rail {
  display: none !important;
}

.n-scrollbar {
  display: none !important;
}

/* 隐藏可能的其他滚动条 */
.n-layout-sider .n-menu {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.n-layout-sider .n-menu::-webkit-scrollbar {
  display: none;
}
</style>