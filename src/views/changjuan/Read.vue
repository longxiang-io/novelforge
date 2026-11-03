<template>
  <div class="cj-page">
    <div class="cj-page-head">
      <div>
        <h1>{{ $t('rest.read.title') }}</h1>
        <div class="cj-muted" style="margin-top: 6px">{{ $t('rest.read.subtitle') }}</div>
      </div>
    </div>
    <div v-if="error" class="cj-error-box">{{ error }}</div>
    <div v-else-if="loading" class="cj-empty">{{ $t('rest.read.loading') }}</div>
    <div v-else-if="!chapters.length" class="cj-empty">{{ $t('rest.read.empty') }}</div>
    <template v-else>
      <div v-if="volumes.length > 1" class="volumes">
        <button v-for="item in volumes" :key="item.id" type="button" class="cj-btn sm" :class="{ on: item.id === volumeId }" @click="openVolume(item.id)">
          {{ $t('rest.read.volumeChapters', { title: item.title, count: item.confirmed }) }}
        </button>
      </div>
      <p v-else-if="volumes[0]" class="cj-muted volume-name">{{ volumes[0].title }}</p>
      <article v-for="chapter in chapters" :key="chapter.id" class="read-chapter">
        <header>
          <h2 class="cj-serif">{{ $t('rest.read.chapterTitle', { number: chapter.number, title: chapter.title }) }}</h2>
          <span class="cj-muted">{{ $t('rest.read.words', { count: numberText(chapter.word_count) }) }}</span>
          <router-link :to="`/changjuan/book/${bookId}/write/${chapter.id}`">{{ $t('rest.read.goWrite') }}</router-link>
        </header>
        <div v-if="lines(chapter.content).length" class="paper cj-serif">
          <p v-for="(line, index) in lines(chapter.content)" :key="index">{{ line }}</p>
        </div>
        <p v-else class="cj-muted empty-chapter">{{ $t('rest.read.emptyChapter') }}</p>
      </article>
    </template>
  </div>
</template>

<script setup>
import { inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cjApi, numberText, toastError } from './api.js'

const route = useRoute()
const router = useRouter()
const { bookId } = inject('cj')
const volumes = ref([])
const volumeId = ref(null)
const chapters = ref([])
const loading = ref(true)
const error = ref('')

const lines = (content) => String(content || '').split('\n').map(line => line.trim()).filter(Boolean)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const requested = Number(route.query.volume)
    const query = Number.isInteger(requested) && requested >= 0 && route.query.volume !== undefined && route.query.volume !== ''
      ? `?volume=${requested}`
      : ''
    const json = await cjApi(`/books/${bookId.value}/read${query}`)
    volumes.value = json.data.volumes || []
    volumeId.value = json.data.volume_id
    chapters.value = json.data.chapters || []
  } catch (err) {
    error.value = err.message
    toastError(err)
  } finally {
    loading.value = false
  }
}

const openVolume = (id) => {
  router.replace({ query: { volume: String(id) } })
}

watch(() => route.query.volume, load, { immediate: true })
</script>

<style scoped>
.volumes { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.volumes .on { background: var(--cj-ink); color: #fff; border-color: var(--cj-ink); }
.volume-name { margin: 0 0 12px; }
.read-chapter { max-width: 720px; margin: 0 auto 36px; }
.read-chapter header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.read-chapter h2 { margin: 0; font-size: 22px; font-weight: 700; }
.read-chapter header a { margin-left: auto; color: var(--cj-accent); font-size: 13px; white-space: nowrap; }
.paper { font-size: 17px; line-height: 2.05; color: #2a2620; }
.paper p { margin: 0 0 14px; }
.empty-chapter { margin: 0; }
</style>
