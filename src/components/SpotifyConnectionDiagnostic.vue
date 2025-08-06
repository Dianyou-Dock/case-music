wodianji<template>
  <div class="diagnostic-overlay">
    <n-card title="🔧 Spotify 连接诊断" class="diagnostic-card">
      <div class="diagnostic-content">
        <n-steps :current="currentStep" :status="stepStatus">
          <n-step title="检查网络连接">
            <template #icon>
              <n-icon><GlobeOutline /></n-icon>
            </template>
          </n-step>
          <n-step title="验证权限">
            <template #icon>
              <n-icon><ShieldCheckmarkOutline /></n-icon>
            </template>
          </n-step>
          <n-step title="初始化播放器">
            <template #icon>
              <n-icon><PlayCircleOutline /></n-icon>
            </template>
          </n-step>
          <n-step title="连接成功">
            <template #icon>
              <n-icon><CheckmarkCircleOutline /></n-icon>
            </template>
          </n-step>
        </n-steps>
        
        <div class="diagnostic-details">
          <n-alert :type="alertType" :title="currentMessage" style="margin: 16px 0;">
            {{ currentDetail }}
          </n-alert>
          
          <div class="diagnostic-actions">
            <n-space>
              <n-button 
                @click="runDiagnostic" 
                type="primary" 
                :loading="isRunning"
                :disabled="isRunning"
              >
                {{ isRunning ? '诊断中...' : '开始诊断' }}
              </n-button>
              
              <n-button @click="forceReset" type="warning" :disabled="isRunning">
                强制重置
              </n-button>
              
              <n-button @click="$emit('close')" :disabled="isRunning">
                关闭
              </n-button>
            </n-space>
          </div>
          
          <div v-if="diagnosticLog.length > 0" class="diagnostic-log">
            <n-divider>诊断日志</n-divider>
            <div class="log-container">
              <div v-for="(log, index) in diagnosticLog" :key="index" class="log-item">
                <n-text :type="log.type">{{ log.message }}</n-text>
                <n-text depth="3" style="font-size: 12px; margin-left: 8px;">
                  {{ formatTime(log.timestamp) }}
                </n-text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue'
import { 
  NCard, NSteps, NStep, NIcon, NAlert, NSpace, NButton, NDivider, NText 
} from 'naive-ui'
import { 
  GlobeOutline, ShieldCheckmarkOutline, PlayCircleOutline, 
  CheckmarkCircleOutline 
} from '@vicons/ionicons5'
import { invoke } from '@tauri-apps/api/core'

defineEmits(['close'])

const currentStep = ref(0)
const stepStatus = ref<'process' | 'finish' | 'error' | 'wait'>('wait')
const isRunning = ref(false)
const currentMessage = ref('准备开始诊断')
const currentDetail = ref('点击"开始诊断"按钮开始检测连接问题')
const alertType = ref<'info' | 'success' | 'warning' | 'error'>('info')
const diagnosticLog = ref<Array<{
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  timestamp: number
}>>([])

const addLog = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  diagnosticLog.value.push({
    message,
    type,
    timestamp: Date.now()
  })
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const runDiagnostic = async () => {
  isRunning.value = true
  currentStep.value = 0
  stepStatus.value = 'process'
  diagnosticLog.value = []
  
  try {
    // 步骤 1: 检查网络连接
    currentMessage.value = '检查网络连接'
    currentDetail.value = '正在测试与 Spotify API 的连接...'
    addLog('开始网络连接测试')
    
    const networkTest = await testNetworkConnection()
    if (!networkTest.success) {
      throw new Error(`网络连接失败: ${networkTest.error}`)
    }
    
    addLog('网络连接正常', 'success')
    currentStep.value = 1
    
    // 步骤 2: 验证权限
    currentMessage.value = '验证权限'
    currentDetail.value = '正在检查 Spotify Token 和用户权限...'
    addLog('开始权限验证')
    
    const permissionTest = await testPermissions()
    if (!permissionTest.success) {
      throw new Error(`权限验证失败: ${permissionTest.error}`)
    }
    
    addLog('权限验证通过', 'success')
    currentStep.value = 2
    
    // 步骤 3: 初始化播放器
    currentMessage.value = '初始化播放器'
    currentDetail.value = '正在测试 Spotify Web Playback SDK...'
    addLog('开始播放器测试')
    
    const playerTest = await testPlayerInitialization()
    if (!playerTest.success) {
      throw new Error(`播放器初始化失败: ${playerTest.error}`)
    }
    
    addLog('播放器初始化成功', 'success')
    currentStep.value = 3
    stepStatus.value = 'finish'
    
    // 完成
    currentMessage.value = '诊断完成'
    currentDetail.value = '所有检查都通过了！如果播放器仍然无法工作，请尝试强制重置。'
    alertType.value = 'success'
    addLog('诊断完成，所有检查通过', 'success')
    
  } catch (error: any) {
    stepStatus.value = 'error'
    currentMessage.value = '诊断发现问题'
    currentDetail.value = error.message
    alertType.value = 'error'
    addLog(`诊断失败: ${error.message}`, 'error')
  } finally {
    isRunning.value = false
  }
}

const testNetworkConnection = async () => {
  try {
    const response = await fetch('https://api.spotify.com/v1/', {
      method: 'GET',
    })
    
    if (response.status === 401) {
      // 401 是正常的，说明可以连接到 Spotify API
      return { success: true }
    }
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

const testPermissions = async () => {
  try {
    const tokenInfo = await invoke('get_token_info') as {
      has_token: boolean
      is_expired: boolean
      token: string
    }
    
    if (!tokenInfo.has_token) {
      return { success: false, error: '没有有效的 Token' }
    }
    
    if (tokenInfo.is_expired) {
      return { success: false, error: 'Token 已过期' }
    }
    
    // 测试用户信息 API
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`
      }
    })
    
    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `API 调用失败: ${response.status} - ${error}` }
    }
    
    const userData = await response.json()
    if (userData.product !== 'premium') {
      return { success: false, error: `需要 Premium 账户，当前: ${userData.product}` }
    }
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

const testPlayerInitialization = async () => {
  try {
    if (!window.Spotify) {
      return { success: false, error: 'Spotify Web Playback SDK 未加载' }
    }
    
    if (!window.Spotify.Player) {
      return { success: false, error: 'Spotify Player 类不可用' }
    }
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

const forceReset = () => {
  addLog('执行强制重置', 'warning')
  // 重新加载页面来完全重置
  setTimeout(() => {
    window.location.reload()
  }, 1000)
}
</script>

<style scoped>
.diagnostic-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.diagnostic-card {
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.diagnostic-content {
  padding: 16px;
}

.diagnostic-details {
  margin-top: 24px;
}

.diagnostic-actions {
  margin: 16px 0;
}

.diagnostic-log {
  margin-top: 16px;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  background-color: #f5f5f5;
  border-radius: 6px;
  padding: 12px;
}

.log-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding: 4px 0;
  border-bottom: 1px solid #eee;
}

.log-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
</style> 