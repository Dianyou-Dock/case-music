<script setup lang="ts">
import { ref } from 'vue'
import { NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import useTheme from '../composables/useTheme'

const { isDarkTheme, themeColor } = useTheme()

const chatgptKey = ref('')
const deepseekKey = ref('')
const kimiKey = ref('')

const message = useMessage()

const saveKey = (type: string) => {
  let keyVal = ''
  if (type === 'chatgpt') keyVal = chatgptKey.value
  else if (type === 'deepseek') keyVal = deepseekKey.value
  else if (type === 'kimi') keyVal = kimiKey.value
  // TODO: 持久化存储 keyVal
  message.success(`${type} API Key 已保存！`)
}
</script>

<template>
  <div class="ai-container">
    <div class="ai-content">
      <h2 class="ai-title" :style="{ color: themeColor }">设置 API Key</h2>
      <n-form label-placement="left">
        <n-form-item label="ChatGPT">
          <n-input v-model:value="chatgptKey" placeholder="输入 ChatGPT Key" style="max-width: 400px" />
          <n-button quaternary ghost round type="primary" @click="saveKey('chatgpt')" style="margin-left: 12px">确认</n-button>
        </n-form-item>
        <n-form-item label="DeepSeek">
          <n-input v-model:value="deepseekKey" placeholder="输入 DeepSeek Key" style="max-width: 400px" />
          <n-button quaternary ghost round type="primary" @click="saveKey('deepseek')" style="margin-left: 12px">确认</n-button>
        </n-form-item>
        <n-form-item label="Kimi">
          <n-input v-model:value="kimiKey" placeholder="输入 Kimi Key" style="max-width: 400px" />
          <n-button quaternary ghost round type="primary" @click="saveKey('kimi')" style="margin-left: 12px">确认</n-button>
        </n-form-item>
      </n-form>
    </div>
  </div>
</template>


<style scoped>
.ai-container {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: v-bind("isDarkTheme ? '#121212' : '#FFFFFF'");
}

.ai-content {
  width: 100%;
  max-width: 400px;
  padding: 20px;
}

.ai-title {
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