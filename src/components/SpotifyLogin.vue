<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NForm, NFormItem, NInput, NButton, useMessage, FormInst } from 'naive-ui'
import useTheme from '../composables/useTheme'
import { invoke } from "@tauri-apps/api/core";

// 定义事件
const emit = defineEmits(['login-status-change'])

const { isDarkTheme, themeColor } = useTheme()
const username = ref('')
const password = ref('')
const clientId = ref('')
const clientSecret = ref('')
const redirectUri = ref('')
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const isLoggedIn = ref(false)

const rules = {
  username: {
    required: true,
    message: '请输入用户名',
    trigger: 'blur'
  },
  clientId: {
    required: true,
    message: '请输入 Client ID',
    trigger: 'blur'
  },
  clientSecret: {
    required: true,
    message: '请输入 Client Secret',
    trigger: 'blur'
  },
  redirectUri: {
    required: true,
    message: '请输入 Redirect URI',
    trigger: 'blur'
  }
}

const handleLogin = async () => {
  try {
    await formRef.value?.validate()
    const response = await invoke('spotify_login', {
      request: {
        username: username.value,
        client_id: clientId.value,
        client_secret: clientSecret.value,
        redirect_uri: redirectUri.value,
      }
    }) as { success: boolean; message: string; token: string | null }

    if (response.success) {
      console.log(response)
      message.success(response.message)
      isLoggedIn.value = true
      // 触发登录状态变化事件
      emit('login-status-change')
    } else {
      message.error(response.message)
    }
  } catch (error: any) {
    if (error?.message) {
      message.error(error.message)
    } else {
      message.error('登录失败：' + error)
    }
  }
}

const handleLogout = async () => {
  try {
    const response = await invoke('spotify_logout') as { success: boolean; message: string }
    
    if (response.success) {
      isLoggedIn.value = false
      message.success(response.message)
      
      // 清空表单数据
      clientId.value = ''
      clientSecret.value = ''
      redirectUri.value = ''
      username.value = ''
      
      // 触发登录状态变化事件
      emit('login-status-change')
    } else {
      message.error(response.message)
    }
  } catch (error: any) {
    if (error?.message) {
      message.error(error.message)
    } else {
      message.error('登出失败：' + error)
    }
  }
}

onMounted(async () => {
  const config = await invoke('check_spotify_login') as any
  if (config) {
    clientId.value = config.client_id || ''
    clientSecret.value = config.client_secret || ''
    redirectUri.value = config.redirect_uri || ''
    username.value = config.username || ''
    if (
      clientId.value &&
      clientSecret.value &&
      redirectUri.value &&
      username.value
    ) {
      isLoggedIn.value = true
    }
  }
})
</script>

<template>
  <div class="login-container">
    <div class="login-content">
      <h2 class="login-title">Spotify</h2>
      <n-form
        ref="formRef"
        :model="{
          username,
          password,
          clientId,
          clientSecret,
          redirectUri
        }"
        :rules="rules"
      >
        <n-form-item label="Client ID" path="clientId">
          <n-input
            v-model:value="clientId"
            placeholder="请输入 Client ID"
            :disabled="isLoggedIn"
          />
        </n-form-item>
        <n-form-item label="Client Secret" path="clientSecret">
          <n-input
            v-model:value="clientSecret"
            show-password-on="click"
            type="password"
            placeholder="请输入 Client Secret"
            :disabled="isLoggedIn"
          />
        </n-form-item>
        <n-form-item label="Redirect URI" path="redirectUri">
          <n-input
            v-model:value="redirectUri"
            placeholder="请输入 Redirect URI"
            :disabled="isLoggedIn"
          />
        </n-form-item>
        <n-form-item label="用户名" path="username">
          <n-input
            v-model:value="username" 
            placeholder="请输入用户名"
            :disabled="isLoggedIn"
          />
        </n-form-item>
        <n-form-item>
          <n-button 
            type="primary" 
            block 
            quaternary ghost round
            @click="isLoggedIn ? handleLogout() : handleLogin()"
          >
            {{ isLoggedIn ? '登出' : '登录' }}
          </n-button>
        </n-form-item>
      </n-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: v-bind("isDarkTheme ? '#121212' : '#FFFFFF'");
}

.login-content {
  width: 100%;
  max-width: 400px;
  padding: 20px;
}

.login-title {
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 32px;
  color: v-bind(themeColor);
}

:deep(.n-form-item-label) {
  font-size: 18px;
  font-weight: 600;
  color: v-bind(themeColor);
}

:deep(.n-input) {
  font-size: 16px;
}

:deep(.n-button) {
  font-size: 18px;
  font-weight: 600;
}
</style> 