<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NForm, NFormItem, NInput, NButton, NSwitch, useMessage, NSpace, NDivider, NCard } from 'naive-ui'
import { invoke } from "@tauri-apps/api/core"
import useTheme from '../composables/useTheme'

const { themeColor, isDarkTheme } = useTheme()
const message = useMessage()
const isLoading = ref(false)
const isReloginLoading = ref(false)

// 设置选项
const autoPlay = ref(false)
const shuffleMode = ref(false)
const repeatMode = ref(false)
const crossfade = ref(false)

// 获取Spotify设置
const fetchSettings = async () => {
  isLoading.value = true
  try {
    // 这里应添加与后端的通信代码获取设置
    // 目前使用本地状态作为示例
    isLoading.value = false
  } catch (error: any) {
    message.error(`获取设置失败: ${error.message || error}`)
    isLoading.value = false
  }
}

// 保存Spotify设置
const saveSettings = async () => {
  isLoading.value = true
  try {
    // 这里应添加与后端的通信代码保存设置
    message.success('设置已保存')
    isLoading.value = false
  } catch (error: any) {
    message.error(`保存设置失败: ${error.message || error}`)
    isLoading.value = false
  }
}

// 强制重新登录Spotify
const forceRelogin = async () => {
  isReloginLoading.value = true
  try {
    const response = await invoke('force_spotify_relogin') as {
      success: boolean
      message: string
    }
    
    if (response.success) {
      message.success(response.message)
      // 导航到登录页面
      // 可以使用window.location.href跳转或其他路由方式
    } else {
      message.error(response.message || '重新登录失败')
    }
  } catch (error: any) {
    message.error(`操作失败: ${error.message || error}`)
  } finally {
    isReloginLoading.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div class="spotify-settings-container">
    <h2 class="settings-title">Spotify 设置</h2>
    
    <n-card title="播放设置">
      <n-form>
        <n-form-item label="自动播放">
          <n-switch v-model:value="autoPlay" />
        </n-form-item>
        
        <n-form-item label="随机播放">
          <n-switch v-model:value="shuffleMode" />
        </n-form-item>
        
        <n-form-item label="循环模式">
          <n-switch v-model:value="repeatMode" />
        </n-form-item>
        
        <n-form-item label="交叉淡入淡出">
          <n-switch v-model:value="crossfade" />
        </n-form-item>
        
        <n-form-item>
          <n-button type="primary" @click="saveSettings" :loading="isLoading">
            保存设置
          </n-button>
        </n-form-item>
      </n-form>
    </n-card>
    
    <n-divider />
    
    <n-card title="账号设置">
      <div class="account-settings">
        <p class="warning-text">如果您遇到Spotify授权错误(如"令牌过期")，请尝试重新登录以刷新令牌。</p>
        <n-button 
          type="warning" 
          @click="forceRelogin" 
          :loading="isReloginLoading"
        >
          重新登录Spotify
        </n-button>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.spotify-settings-container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.settings-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 24px;
  color: v-bind(themeColor);
}

:deep(.n-form-item-label) {
  font-size: 16px;
  font-weight: 600;
  color: v-bind(themeColor);
}

.account-settings {
  margin: 20px 0;
}

.warning-text {
  color: #ff4d4f;
  margin-bottom: 15px;
  font-size: 14px;
}
</style> 