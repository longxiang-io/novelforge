<template>
  <button type="button" class="locale-switch" @click="toggle">{{ nextLabel }}</button>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '../i18n.js'

const { locale } = useI18n()
const nextLabel = computed(() => (locale.value === 'zh-CN' ? 'EN' : '中文'))
const toggle = () => setLocale(locale.value === 'zh-CN' ? 'en' : 'zh-CN')
</script>

<style scoped>
.locale-switch {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  min-height: 32px;
  padding: 0 8px;
}
</style>
