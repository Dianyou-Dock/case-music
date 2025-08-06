<template>
  <div class="spotify-debug">
    <n-card title="Spotify 连接状态调试" class="debug-card">
      <div class="debug-section">
        <n-space vertical>
          <div class="debug-item">
            <n-text strong>用户信息:</n-text>
            <n-code v-if="userProfile" :code="JSON.stringify(userProfile, null, 2)" language="json" />
            <n-text v-else>暂无用户信息</n-text>
          </div>
          
          <div class="debug-item">
            <n-text strong>Premium 状态:</n-text>
            <n-tag :type="isPremium ? 'success' : 'error'">
              {{ isPremium ? '已开通 Premium' : '未开通 Premium' }}
            </n-tag>
            <n-text v-if="userProfile?.product" depth="3">
              产品类型: {{ userProfile.product }}
            </n-text>
          </div>
          
          <div class="debug-item">
            <n-text strong>Token 状态:</n-text>
            <n-code v-if="tokenInfo" :code="JSON.stringify(tokenInfo, null, 2)" language="json" />
            <n-text v-else>暂无 Token 信息</n-text>
          </div>
          
          <div class="debug-item">
            <n-text strong>播放器状态:</n-text>
            <n-code v-if="playerStatus" :code="JSON.stringify(playerStatus, null, 2)" language="json" />
            <n-text v-else>播放器未初始化</n-text>
          </div>
          
          <div class="debug-item">
            <n-text strong>错误信息:</n-text>
            <n-text v-if="error" type="error">{{ error }}</n-text>
            <n-text v-else type="success">无错误</n-text>
          </div>
          
          <n-space>
            <n-button @click="refreshUserInfo" type="primary">刷新用户信息</n-button>
            <n-button @click="refreshTokenInfo" type="info">刷新 Token 信息</n-button>
            <n-button @click="checkPlayerStatus" type="warning">检查播放器状态</n-button>
            <n-button @click="testAPICall" type="success">测试 API 调用</n-button>
          </n-space>
          
          <n-space style="margin-top: 12px;">
            <n-button @click="checkTokenScopes" type="info">检查 Token 权限</n-button>
            <n-button @click="forceRelogin" type="error">强制重新登录</n-button>
            <n-button @click="forceResetPlayer" type="warning">强制重置播放器</n-button>
          </n-space>
        </n-space>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NCard, NSpace, NText, NCode, NTag, NButton, useMessage } from 'naive-ui'
import { invoke } from '@tauri-apps/api/core'

const message = useMessage()

const userProfile = ref<any>(null)
const tokenInfo = ref<any>(null)
const playerStatus = ref<any>(null)
const error = ref<string | null>(null)
const isPremium = ref(false)

// 刷新用户信息
const refreshUserInfo = async () => {
  try {
    const response = await invoke('get_current_user_profile') as {
      success: boolean;
      message: string;
      profile?: any;
    }
    
    if (response.success) {
      userProfile.value = response.profile
      isPremium.value = response.profile?.product === 'premium'
      message.success('用户信息刷新成功')
    } else {
      error.value = response.message
      message.error('获取用户信息失败: ' + response.message)
    }
  } catch (err: any) {
    error.value = err.message
    message.error('获取用户信息失败: ' + err.message)
  }
}

// 刷新 Token 信息
const refreshTokenInfo = async () => {
  try {
    const response = await invoke('get_token_info') as any
    tokenInfo.value = response
    message.success('Token 信息刷新成功')
  } catch (err: any) {
    error.value = err.message
    message.error('获取 Token 信息失败: ' + err.message)
  }
}

// 检查播放器状态
const checkPlayerStatus = () => {
  playerStatus.value = {
    sdkLoaded: !!window.Spotify,
    sdkReady: window.SpotifyWebPlaybackSDKReady || false,
    webPlayerAvailable: !!(window.Spotify && window.Spotify.Player),
  }
  message.info('播放器状态已更新')
}

// 测试 API 调用
const testAPICall = async () => {
  try {
    const token = await invoke('get_valid_token') as string
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      message.success('API 调用成功')
      console.log('API 响应:', data)
      
      // 检查用户产品类型
      if (data.product !== 'premium') {
        message.warning(`检测到您的账户类型为: ${data.product}，需要 Premium 账户才能使用播放功能`)
      }
    } else {
      const errorText = await response.text()
      message.error(`API 调用失败: ${response.status} - ${errorText}`)
      
      // 如果是权限问题，提示重新登录
      if (response.status === 403 || errorText.includes('insufficient')) {
        message.error('Token 权限不足，可能需要重新登录 Spotify')
      }
    }
  } catch (err: any) {
    error.value = err.message
    message.error('API 调用失败: ' + err.message)
  }
}

// 强制重新登录 Spotify
const forceRelogin = async () => {
  try {
    const response = await invoke('force_spotify_relogin') as {
      success: boolean;
      message: string;
    }
    
    if (response.success) {
      message.success('重新登录成功，请稍后刷新页面')
      // 等待几秒后自动刷新信息
      setTimeout(() => {
        refreshUserInfo()
        refreshTokenInfo()
      }, 2000)
    } else {
      message.error('重新登录失败: ' + response.message)
    }
  } catch (err: any) {
    error.value = err.message
    message.error('重新登录失败: ' + err.message)
  }
}

// 检查 Token 权限范围
const checkTokenScopes = async () => {
  try {
    const token = await invoke('get_valid_token') as string
    
    // 使用 token 调用需要特定权限的 API
    const testEndpoints = [
      { url: 'https://api.spotify.com/v1/me', scope: 'user-read-private' },
      { url: 'https://api.spotify.com/v1/me/player', scope: 'user-read-playback-state' },
    ]
    
    const results = []
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        results.push({
          scope: endpoint.scope,
          status: response.status,
          success: response.ok
        })
      } catch (err) {
        results.push({
          scope: endpoint.scope,
          status: 'error',
          success: false,
          error: err
        })
      }
    }
    
    console.log('权限检查结果:', results)
    
    const failedScopes = results.filter(r => !r.success)
    if (failedScopes.length > 0) {
      message.warning(`检测到 ${failedScopes.length} 个权限可能有问题，建议重新登录`)
    } else {
      message.success('所有权限检查通过')
    }
    
  } catch (err: any) {
    error.value = err.message
    message.error('权限检查失败: ' + err.message)
  }
}

// 强制重置播放器
const forceResetPlayer = async () => {
  try {
    // 这里我们需要从播放器组件获取重置功能
    // 由于这是调试组件，我们可以通过刷新页面来强制重置
    message.info('正在强制重置播放器...')
    
    // 清除本地存储中的播放器状态（如果有）
    if (typeof window !== 'undefined') {
      // 重新加载页面来完全重置播放器状态
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      message.success('播放器将在1秒后重置（页面重新加载）')
    }
  } catch (err: any) {
    error.value = err.message
    message.error('重置播放器失败: ' + err.message)
  }
}

// 组件挂载时初始化
onMounted(() => {
  refreshUserInfo()
  refreshTokenInfo()
  checkPlayerStatus()
})
</script>

<style scoped>
.spotify-debug {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.debug-card {
  margin-bottom: 20px;
}

.debug-section {
  padding: 16px;
}

.debug-item {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background-color: #fafafa;
}

.debug-item:last-child {
  margin-bottom: 0;
}
</style> 