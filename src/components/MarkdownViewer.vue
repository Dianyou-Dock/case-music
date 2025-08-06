<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{ source: string }>()

const md = new MarkdownIt({ html: true, linkify: true })
const rendered = computed(() => md.render(props.source))
</script>

<template>
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body {
  padding: 24px;
  line-height: 1.7;
  font-size: 18px;
}

.markdown-body h1 {
  font-size: 36px;
  margin-bottom: 16px;
}

.markdown-body h2 {
  font-size: 28px;
  margin: 16px 0 12px;
}
</style> 