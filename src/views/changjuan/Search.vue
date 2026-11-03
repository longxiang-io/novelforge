<template>
  <div class="cj-page">
    <div class="cj-page-head">
      <div>
        <h1>{{ $t('rest.search.title') }}</h1>
        <div class="cj-muted" style="margin-top: 6px">{{ $t('rest.search.subtitle') }}</div>
      </div>
    </div>
    <form class="search-bar" @submit.prevent="applyNow">
      <el-input ref="inputRef" v-model="draft" :placeholder="$t('rest.search.placeholder')" maxlength="40" clearable @input="schedule" @clear="applyNow" />
      <button class="cj-btn pri" type="submit">{{ $t('rest.search.submit') }}</button>
    </form>
    <div v-if="error" class="cj-error-box">{{ error }}</div>
    <div v-else-if="loading" class="cj-empty">{{ $t('rest.search.loading') }}</div>
    <div v-else-if="!query" class="cj-empty">{{ $t('rest.search.prompt') }}</div>
    <div v-else-if="!hits.length" class="cj-empty">{{ $t('rest.search.none', { query }) }}</div>
    <template v-else>
      <section v-for="group in groups" :key="group.title" class="search-group">
        <h2>{{ group.title }}</h2>
        <button v-for="(item, index) in group.items" :key="`${item.page}-${item.chapter_id}-${item.foreshadow_id}-${item.card}-${index}`" type="button" class="cj-card hit" @click="openHit(item)">
          <span class="hit-label">{{ item.label }}</span>
          <b>{{ item.title }}</b>
          <span class="snippet">
            <template v-for="(part, partIndex) in parts(item.snippet)" :key="partIndex">
              <mark v-if="part.hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </span>
        </button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { cjApi, toastError } from './api.js'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const { bookId } = inject('cj')
const draft = ref(String(route.query.q || ''))
const query = ref('')
const hits = ref([])
const loading = ref(false)
const error = ref('')
const inputRef = ref(null)
let timer = null
let request = 0

const groups = computed(() => [
  { title: t('rest.search.groups.write'), items: hits.value.filter(item => item.page === 'write') },
  { title: t('rest.search.groups.outline'), items: hits.value.filter(item => item.page === 'outline') },
  { title: t('rest.search.groups.memory'), items: hits.value.filter(item => item.page === 'memory') },
  { title: t('rest.search.groups.foreshadows'), items: hits.value.filter(item => item.page === 'foreshadows') }
].filter(group => group.items.length))

const parts = (snippet) => {
  const needle = query.value.toLowerCase()
  const at = needle ? snippet.toLowerCase().indexOf(needle) : -1
  if (at < 0) return [{ text: snippet, hit: false }]
  return [
    { text: snippet.slice(0, at), hit: false },
    { text: snippet.slice(at, at + needle.length), hit: true },
    { text: snippet.slice(at + needle.length), hit: false }
  ].filter(part => part.text)
}

const load = async (value) => {
  const current = ++request
  query.value = value
  if (!value) {
    hits.value = []
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    const json = await cjApi(`/books/${bookId.value}/search?q=${encodeURIComponent(value)}`)
    if (current !== request) return
    hits.value = json.data.hits || []
  } catch (err) {
    if (current !== request) return
    error.value = err.message
    toastError(err)
  } finally {
    if (current === request) loading.value = false
  }
}

const applyNow = () => {
  clearTimeout(timer)
  const value = draft.value.trim().slice(0, 40)
  draft.value = value
  const next = value ? { q: value } : {}
  if (String(route.query.q || '') !== value) router.replace({ query: next })
  else load(value)
}

const schedule = () => {
  clearTimeout(timer)
  timer = setTimeout(applyNow, 300)
}

watch(() => route.query.q, (value) => {
  const next = String(value || '')
  if (draft.value !== next) draft.value = next
  load(next.trim())
}, { immediate: true })

const openHit = (item) => {
  const base = `/changjuan/book/${bookId.value}`
  if (item.page === 'write') {
    router.push({ path: `${base}/write/${item.chapter_id}`, query: item.paragraph ? { p: String(item.paragraph) } : {} })
  } else if (item.page === 'outline') {
    const query = { type: item.outline_type }
    if (item.outline_id) query.id = String(item.outline_id)
    router.push({ path: `${base}/outline`, query })
  } else if (item.page === 'memory') {
    router.push({ path: `${base}/memory`, query: { card: item.card } })
  } else if (item.page === 'foreshadows') {
    router.push({ path: `${base}/foreshadows`, query: { id: String(item.foreshadow_id) } })
  }
}

onMounted(() => nextTick(() => inputRef.value?.focus?.()))
</script>

<style scoped>
.search-bar { display: flex; gap: 8px; max-width: 640px; margin-bottom: 18px; }
.search-bar .el-input { flex: 1; }
.search-group { margin-top: 8px; }
.search-group h2 { margin: 16px 0 8px; font-size: 14px; color: var(--cj-sub); font-weight: 600; }
.hit {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 8px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.hit:hover { border-color: var(--cj-accent); }
.hit-label { font-size: 12px; color: var(--cj-accent); }
.snippet { color: var(--cj-sub); font-size: 13px; line-height: 1.7; }
.snippet mark { background: #f3e2c2; color: inherit; padding: 0 1px; }
</style>
