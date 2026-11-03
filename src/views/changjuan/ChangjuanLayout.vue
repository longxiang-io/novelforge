<template>
  <div class="cj-app" :class="{ 'is-mobile': isMobile }">
    <header v-if="isMobile" class="m-top">
      <button v-if="showBack" type="button" class="m-icon" @click="goBack">{{ $t('shell.layout.back') }}</button>
      <router-link v-else to="/changjuan" class="m-icon m-logo" :title="t('nav.shelf')"><BrandMark compact /></router-link>
      <div class="m-title">{{ mobileTitle }}</div>
      <el-dropdown trigger="click" popper-class="cj-popper" @command="handleCommand">
        <button type="button" class="m-icon m-user">
          <UserAvatar :name="userName" :avatar="userAvatar" size="sm" />
          {{ $t('nav.more') }}
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="shelf">{{ $t('shell.layout.myShelf') }}</el-dropdown-item>
            <el-dropdown-item command="guide">{{ $t('nav.guide') }}</el-dropdown-item>
            <el-dropdown-item command="account">{{ $t('nav.account') }}</el-dropdown-item>
            <el-dropdown-item command="logout" divided>{{ $t('nav.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>
    <header v-else class="cj-top">
      <router-link to="/changjuan" class="cj-logo" :title="t('nav.backToShelf')"><BrandMark /></router-link>
      <div v-if="bookId && store.book" class="cj-book">
        {{ store.book.title }}
        <small>{{ $t('shell.layout.bookStats', { volume: currentVolumeTitle, count: store.confirmed_count, words: numberText(store.confirmed_words) }) }}</small>
      </div>
      <nav v-if="bookId" class="cj-nav">
        <router-link v-for="item in navItems" :key="item.key" :to="`/changjuan/book/${bookId}/${item.path}`"
          :class="{ on: route.meta.nav === item.key }">{{ item.label }}</router-link>
      </nav>
      <div class="cj-spacer"></div>
      <router-link v-if="bookId" :to="`/changjuan/book/${bookId}/search`" class="cj-icon-link" :class="{ on: route.meta.nav === 'search' }" :title="$t('nav.search')">
        <t-icon name="search" />
      </router-link>
      <LocaleSwitch />
      <router-link :to="bookId ? `/changjuan/book/${bookId}/settings` : '/changjuan/settings'" class="cj-icon-link" :title="t('nav.settings')">
        <t-icon name="setting" />
      </router-link>
      <el-dropdown trigger="click" popper-class="cj-popper" @command="handleCommand">
        <span class="avatar-trigger" :title="userName">
          <UserAvatar :name="userName" :avatar="userAvatar" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="shelf">{{ $t('shell.layout.myShelf') }}</el-dropdown-item>
            <el-dropdown-item command="guide">{{ $t('nav.guide') }}</el-dropdown-item>
            <el-dropdown-item command="account">{{ $t('nav.account') }}</el-dropdown-item>
            <el-dropdown-item command="logout" divided>{{ $t('nav.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>
    <div v-if="loadError" class="cj-page"><div class="cj-error-box">{{ loadError }}</div></div>
    <router-view v-else v-slot="{ Component }">
      <component :is="Component" :key="routeKey" />
    </router-view>
    <nav v-if="isMobile && bookId && keyboardInset < 80" class="m-tabs">
      <router-link v-for="item in mobileTabs" :key="item.key" :to="`/changjuan/book/${bookId}/${item.path}`" :class="{ on: route.meta.nav === item.key }">{{ item.label }}</router-link>
      <button type="button" :class="{ on: moreOn }" @click="moreOpen = true">{{ $t('nav.more') }}</button>
    </nav>
    <div v-if="isMobile && moreOpen" class="m-more-mask" @click.self="moreOpen = false">
      <div class="m-more">
        <router-link :to="`/changjuan/book/${bookId}/search`" @click="moreOpen = false">{{ $t('nav.search') }}</router-link>
        <router-link :to="`/changjuan/book/${bookId}/read`" @click="moreOpen = false">{{ $t('nav.read') }}</router-link>
        <router-link :to="`/changjuan/book/${bookId}/stats`" @click="moreOpen = false">{{ $t('nav.stats') }}</router-link>
        <router-link :to="`/changjuan/book/${bookId}/versions`" @click="moreOpen = false">{{ $t('shell.layout.versions') }}</router-link>
        <router-link :to="`/changjuan/book/${bookId}/settings`" @click="moreOpen = false">{{ $t('nav.settings') }}</router-link>
        <button type="button" @click="moreOpen = false">{{ $t('shell.layout.cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, provide, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { cjApi, numberText } from './api.js'
import { clearSession, handleAuthExpired, saveSession, sessionUser } from '../../utils/authSession.js'
import { useIsMobile } from '../../composables/useIsMobile.js'
import BrandMark from '../../components/BrandMark.vue'
import LocaleSwitch from '../../components/LocaleSwitch.vue'
import UserAvatar from './components/UserAvatar.vue'
import './changjuan.css'

defineOptions({ name: 'ChangjuanLayout' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isMobile, keyboardInset } = useIsMobile()

const navItems = computed(() => [
  { key: 'write', path: 'write', label: t('nav.write') },
  { key: 'memory', path: 'memory', label: t('nav.memory') },
  { key: 'foreshadows', path: 'foreshadows', label: t('nav.foreshadows') },
  { key: 'outline', path: 'outline', label: t('nav.outline') },
  { key: 'stats', path: 'stats', label: t('nav.stats') },
  { key: 'read', path: 'read', label: t('nav.read') }
])

const mobileTabs = computed(() => [
  { key: 'write', path: 'write', label: t('nav.write') },
  { key: 'outline', path: 'outline', label: t('nav.outline') },
  { key: 'memory', path: 'memory', label: t('nav.memory') },
  { key: 'foreshadows', path: 'foreshadows', label: t('nav.foreshadows') }
])

const bookId = computed(() => Number(route.params.bookId) || 0)
const moreOpen = ref(false)
const mobileBack = ref(null)
const showBack = computed(() => route.name !== 'changjuanShelf')
const moreOn = computed(() => ['changjuanStats', 'changjuanVersions', 'changjuanBookSettings', 'changjuanRead', 'changjuanSearch'].includes(String(route.name || '')))
// 写作页切换章节时保留组件实例，其他页面按路径刷新
const routeKey = computed(() => (route.name === 'changjuanWrite' ? `write-${bookId.value}` : route.path))

// 本书概况，供各子页面共享
const store = reactive({
  book: null,
  volumes: [],
  chapters: [],
  confirmed_count: 0,
  confirmed_words: 0,
  cost_per_10k: null,
  month: { cost: 0, tokens: 0 }
})
const loadError = ref('')

const storedUser = computed(() => sessionUser.value)
const userName = computed(() => storedUser.value.name || storedUser.value.username || '')
const userAvatar = computed(() => storedUser.value.avatar || '')
const mobileTitle = computed(() => (bookId.value && store.book?.title) || (route.meta.title ? t(route.meta.title) : t('brand')))

const currentVolumeTitle = computed(() => {
  const chapterId = Number(route.params.chapterId) || 0
  const chapter = store.chapters.find(item => item.id === chapterId) || store.chapters.find(item => item.status !== 'confirmed')
  const volume = store.volumes.find(item => item.id === chapter?.volume_id)
  return volume ? `${volume.title} · ` : ''
})

const reload = async () => {
  loadError.value = ''
  try {
    if (bookId.value) {
      const json = await cjApi(`/books/${bookId.value}`)
      Object.assign(store, json.data)
      document.title = `${json.data.book.title} · ${t('brand')}`
    } else {
      const json = await cjApi('/books')
      store.book = null
      store.month = json.data.month
      document.title = t('brand')
    }
  } catch (err) {
    if (err.status === 401) return
    loadError.value = err.message
  }
}

watch(bookId, reload, { immediate: true })

onMounted(async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json().catch(() => ({}))
    if (res.status === 401) {
      handleAuthExpired(token, router)
      return
    }
    if (json?.data?.user) saveSession(null, json.data.user)
  } catch {}
})

provide('cj', { store, reload, bookId, mobileBack })

const goBack = () => {
  if (typeof mobileBack.value === 'function') {
    mobileBack.value()
    return
  }
  router.push('/changjuan')
}

watch(() => route.fullPath, () => { moreOpen.value = false })

const handleCommand = (command) => {
  if (command === 'shelf') router.push('/changjuan')
  else if (command === 'guide') router.push('/guide')
  else if (command === 'account') router.push('/changjuan/account')
  else if (command === 'logout') {
    clearSession()
    ElMessage.success(t('shell.layout.loggedOut'))
    router.push('/login')
  }
}
</script>

<style scoped>
.cj-top {
  height: 52px;
  background: var(--cj-paper);
  border-bottom: 1px solid var(--cj-line);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 18px;
  flex-shrink: 0;
}
.cj-logo {
  font-family: var(--cj-serif);
  font-weight: 700;
  font-size: 20px;
  color: var(--cj-accent);
  letter-spacing: 1px;
  text-decoration: none;
  display: inline-flex;
  flex-shrink: 0;
}
.cj-logo img { height: 28px; display: block; }
.cj-book { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; }
.cj-book small { color: var(--cj-sub); font-weight: 400; margin-left: 6px; font-size: 12px; }
.cj-nav { display: flex; gap: 4px; margin-left: 12px; }
.cj-nav a { padding: 7px 14px; border-radius: 6px; color: var(--cj-sub); text-decoration: none; white-space: nowrap; }
.cj-nav a:hover { background: var(--cj-gray-soft); }
.cj-nav a.on { background: var(--cj-accent-soft); color: var(--cj-accent); font-weight: 600; }
.cj-icon-link { color: var(--cj-sub); display: inline-flex; font-size: 18px; }
.cj-icon-link:hover,
.cj-icon-link.on { color: var(--cj-accent); }
.avatar-trigger { display: inline-flex; cursor: pointer; }
.m-top {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: calc(4px + env(safe-area-inset-top)) 8px 4px;
  background: var(--cj-paper);
  border-bottom: 1px solid var(--cj-line);
  flex-shrink: 0;
}
.m-icon {
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--cj-accent);
  font: inherit;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-decoration: none;
}
.m-logo img { height: 26px; display: block; }
.m-user { gap: 4px; }
.m-title {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  font-size: 16px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.m-tabs {
  display: flex;
  flex-shrink: 0;
  background: var(--cj-paper);
  border-top: 1px solid var(--cj-line);
  padding-bottom: env(safe-area-inset-bottom);
}
.m-tabs a,
.m-tabs button {
  flex: 1;
  min-width: 0;
  min-height: 50px;
  border: 0;
  background: transparent;
  color: var(--cj-sub);
  font: inherit;
  font-size: 12px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m-tabs .on { color: var(--cj-accent); font-weight: 700; }
.m-more-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(35, 32, 28, 0.35);
  display: flex;
  align-items: flex-end;
}
.m-more {
  width: 100%;
  background: var(--cj-paper);
  border-radius: 16px 16px 0 0;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}
.m-more a,
.m-more button {
  min-height: 48px;
  border: 0;
  border-bottom: 1px solid var(--cj-line);
  background: transparent;
  color: var(--cj-ink);
  font: inherit;
  font-size: 16px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m-more button:last-child { border-bottom: 0; color: var(--cj-sub); }
@media (max-width: 768px) {
  .cj-top { padding: 0 12px; gap: 10px; overflow-x: auto; }
  .cj-book small { display: none; }
  .cj-nav { margin-left: 0; }
  .cj-nav a { padding: 6px 8px; }
}
</style>
