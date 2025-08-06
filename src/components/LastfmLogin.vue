<script setup lang="ts">
import { ref } from 'vue'
import { NForm, NFormItem, NInput, NButton } from 'naive-ui'
import useTheme from '../composables/useTheme'

const { isDarkTheme, themeColor } = useTheme()
const username = ref('')
const password = ref('')

const handleLogin = () => {
  // TODO: 实现 Last.fm 登录逻辑
  console.log('Last.fm login:', { username: username.value, password: password.value })
}
</script>

<template>
  <div class="login-container">
    <div class="login-content">
      <h2 class="login-title">Last.fm</h2>
      <n-form>
        <n-form-item label="用户名">
          <n-input v-model:value="username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="password" type="password" placeholder="请输入密码" show-password-on="click" />
        </n-form-item>
        <n-form-item>
          <n-button type="primary" quaternary ghost round block @click="handleLogin">登录</n-button>
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