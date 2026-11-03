<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { applyDocumentTitle } from './router/index.js'
import { useIsMobile } from './composables/useIsMobile.js'

useIsMobile()

const route = useRoute()
const { locale } = useI18n()
const elementLocale = computed(() => (locale.value === 'zh-CN' ? zhCn : en))

watch(locale, () => {
  applyDocumentTitle(route)
}, { immediate: true })
</script>
