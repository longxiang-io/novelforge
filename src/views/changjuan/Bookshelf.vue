<template>
  <div class="shelf-shell">
  <div v-if="isMobile" class="m-shelf">
    <div class="m-shelf-actions">
      <button type="button" class="cj-btn" @click="openIdea()">{{ $t('tasks.assist') }}</button>
      <button type="button" class="cj-btn pri" @click="openCreate">{{ $t('shell.shelf.new') }}</button>
    </div>
    <p class="cj-muted m-lead">{{ $t('shell.shelf.mobileLead') }}<router-link class="guide-link" to="/guide">{{ $t('nav.guide') }}</router-link></p>
    <div v-if="loading" class="cj-empty">{{ $t('shell.shelf.loading') }}</div>
    <div v-else-if="error" class="cj-error-box">{{ error }}</div>
    <template v-else>
      <article v-for="book in books" :key="book.id" class="cj-card m-book">
        <button type="button" class="m-book-open" @click="openBook(book)">
          <b class="cj-serif">{{ book.title }}</b>
          <span class="cj-muted">{{ $t('shell.shelf.confirmed', { count: book.confirmed_count, words: numberText(book.confirmed_words) }) }}</span>
          <span class="m-alert">
            <template v-if="book.next_chapter?.must_count">{{ $t('shell.shelf.mustFix', { number: book.next_chapter.number, count: book.next_chapter.must_count }) }}</template>
            <template v-if="book.overdue_foreshadows">{{ $t('shell.shelf.overdue', { count: book.overdue_foreshadows }) }}</template>
            <template v-if="!book.next_chapter?.must_count && !book.overdue_foreshadows">{{ $t('shell.shelf.noIssues') }}</template>
          </span>
        </button>
        <div class="m-book-links">
          <button type="button" class="cj-btn pri" @click="openBook(book)">{{ book.next_chapter ? $t('shell.shelf.continue', { number: book.next_chapter.number }) : $t('shell.shelf.open') }}</button>
          <button type="button" class="cj-btn" @click="router.push(`/changjuan/book/${book.id}/outline`)">{{ $t('nav.outline') }}</button>
          <button type="button" class="cj-btn" :disabled="exporting === book.id" @click="exportBook(book)">{{ $t('shell.shelf.export') }}</button>
        </div>
      </article>
      <div v-if="showCreate || !books.length" class="cj-card create-card">
        <b style="font-size: 14px">{{ $t('shell.shelf.createTitle') }}</b>
        <div class="cj-muted" style="margin: 6px 0 16px">{{ $t('shell.shelf.createHint') }}</div>
        <div class="create-form">
          <div class="row full">
            <label>{{ $t('shell.shelf.title') }}</label>
            <el-input v-model="form.title" maxlength="60" :placeholder="$t('shell.shelf.titlePlaceholder')" @keyup.enter="createBook" />
          </div>
          <div class="row">
            <label>{{ $t('shell.shelf.chapterWords') }}</label>
            <el-input-number v-model="form.chapter_words" :min="300" :max="20000" :step="500" controls-position="right" />
          </div>
          <div class="row">
            <label>{{ $t('shell.shelf.foreshadowRemind') }}</label>
            <el-input-number v-model="form.foreshadow_remind" :min="0" :max="50" controls-position="right" />
            <span class="cj-muted unit">{{ $t('shell.shelf.chapterUnit') }}</span>
          </div>
        </div>
        <div class="m-create-actions">
          <button v-if="books.length" type="button" class="cj-btn" @click="showCreate = false">{{ $t('shell.shelf.cancel') }}</button>
          <button type="button" class="cj-btn pri" :disabled="creating" @click="createBook">{{ creating ? $t('shell.shelf.creating') : $t('shell.shelf.create') }}</button>
        </div>
      </div>
    </template>
  </div>
  <div v-else class="cj-page">
    <div class="shelf">
      <div class="cj-page-head">
        <div>
          <h1>{{ $t('shell.shelf.heading') }}</h1>
          <div class="cj-muted" style="margin-top: 6px">{{ $t('shell.shelf.lead') }}<router-link class="guide-link" to="/guide">{{ $t('nav.guide') }}</router-link></div>
        </div>
        <div class="cj-spacer"></div>
        <button class="cj-btn" @click="openIdea()">{{ $t('shell.shelf.chatIdea') }}</button>
        <button class="cj-btn pri" @click="openCreate">{{ $t('shell.shelf.newBook') }}</button>
      </div>
      <div v-if="loading" class="cj-empty">{{ $t('shell.shelf.loading') }}</div>
      <div v-else-if="error" class="cj-error-box">{{ error }}</div>
      <div v-else class="shelf-grid">
        <div v-for="book in books" :key="book.id" class="cj-card book-card">
          <div class="book-title cj-serif">{{ book.title }}</div>
          <div class="cj-muted" style="font-size: 12px">{{ $t('shell.shelf.updated', { time: timeText(book.updated_at) }) }}</div>
          <div class="book-stats">
            <div><span class="cj-muted">{{ $t('shell.shelf.confirmedLabel') }}</span><b>{{ $t('shell.shelf.chapterCount', { count: book.confirmed_count }) }}</b></div>
            <div><span class="cj-muted">{{ $t('shell.shelf.wordsLabel') }}</span><b>{{ numberText(book.confirmed_words) }}</b></div>
          </div>
          <div class="book-alerts">
            <template v-if="book.next_chapter?.must_count">
              <span class="cj-dot red"></span> {{ $t('shell.shelf.mustFix', { number: book.next_chapter.number, count: book.next_chapter.must_count }) }}
            </template>
            <template v-if="book.overdue_foreshadows">
              <span v-if="book.next_chapter?.must_count"> · </span>
              <span style="color: var(--cj-red)">{{ $t('shell.shelf.overdue', { count: book.overdue_foreshadows }) }}</span>
            </template>
            <span v-if="!book.next_chapter?.must_count && !book.overdue_foreshadows" class="cj-muted">{{ $t('shell.shelf.noIssues') }}</span>
          </div>
          <button class="cj-btn pri block" @click="openBook(book)">
            {{ book.next_chapter ? $t('shell.shelf.continue', { number: book.next_chapter.number }) : $t('shell.shelf.open') }}
          </button>
          <div class="book-links">
            <button class="cj-btn ghost sm" @click="router.push(`/changjuan/book/${book.id}/outline`)">{{ $t('nav.outline') }}</button>
            <button class="cj-btn ghost sm" :disabled="exporting === book.id" @click="exportBook(book)">{{ $t('shell.shelf.exportBook') }}</button>
          </div>
        </div>

        <div v-if="showCreate || !books.length" class="cj-card create-card">
          <b style="font-size: 14px">{{ $t('shell.shelf.createTitle') }}</b>
          <div class="cj-muted" style="margin: 6px 0 16px">{{ $t('shell.shelf.createHint') }}</div>
          <div class="create-form">
            <div class="row full">
              <label>{{ $t('shell.shelf.title') }}</label>
              <el-input v-model="form.title" maxlength="60" :placeholder="$t('shell.shelf.titlePlaceholder')" @keyup.enter="createBook" />
            </div>
            <div class="row">
              <label>{{ $t('shell.shelf.chapterWords') }}</label>
              <el-input-number v-model="form.chapter_words" :min="300" :max="20000" :step="500" controls-position="right" />
            </div>
            <div class="row">
              <label>{{ $t('shell.shelf.foreshadowRemind') }}</label>
              <el-input-number v-model="form.foreshadow_remind" :min="0" :max="50" controls-position="right" />
              <span class="cj-muted unit">{{ $t('shell.shelf.chapterUnit') }}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px">
            <button v-if="books.length" class="cj-btn" @click="showCreate = false">{{ $t('shell.shelf.cancel') }}</button>
            <button class="cj-btn pri" :disabled="creating" @click="createBook">{{ creating ? $t('shell.shelf.creating') : $t('shell.shelf.create') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <AiChatPanel v-if="ideaOpen" :key="ideaKey" target-type="new_book" :heading="$t('shell.shelf.ideaHeading')" show-fill :fill-prompt="$t('shell.shelf.ideaPrompt')" @close="ideaOpen = false" />
  </div>
</template>

<script setup>
import { inject, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AiChatPanel from './components/AiChatPanel.vue'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { cjApi, cjDownload, numberText, timeText, toastError } from './api.js'

const { t } = useI18n()
const { isMobile } = useIsMobile()

const router = useRouter()
const { store } = inject('cj')
const books = ref([])
const loading = ref(true)
const error = ref('')
const showCreate = ref(false)
const creating = ref(false)
const exporting = ref(0)
const ideaOpen = ref(false)
const ideaKey = ref(0)
const form = reactive({ title: '', chapter_words: 2500, foreshadow_remind: 3 })

const openIdea = () => {
  ideaKey.value += 1
  ideaOpen.value = true
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const json = await cjApi('/books')
    books.value = json.data.books
    store.month = json.data.month
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  showCreate.value = true
  form.title = ''
}

const createBook = async () => {
  if (!form.title.trim()) return ElMessage.warning(t('shell.shelf.titleRequired'))
  creating.value = true
  try {
    const json = await cjApi('/books', { method: 'POST', body: { ...form } })
    ElMessage.success(t('shell.shelf.created'))
    router.push(`/changjuan/book/${json.data.id}/outline`)
  } catch (err) {
    toastError(err)
  } finally {
    creating.value = false
  }
}

const openBook = (book) => {
  const chapter = book.next_chapter
  router.push(chapter ? `/changjuan/book/${book.id}/write/${chapter.id}` : `/changjuan/book/${book.id}/write`)
}

const exportBook = async (book) => {
  exporting.value = book.id
  try {
    const name = await cjDownload(`/books/${book.id}/export`, `${book.title}.zip`)
    ElMessage.success(t('shell.shelf.exported', { name }))
  } catch (err) {
    toastError(err)
  } finally {
    exporting.value = 0
  }
}

onMounted(() => { load() })
</script>

<style scoped>
.shelf-shell { flex: 1; min-height: 0; display: flex; }
.shelf { max-width: 1100px; margin: 24px auto 0; }
@media (max-width: 768px) {
  .shelf-shell { flex-direction: column; }
}
.shelf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; align-items: start; }
.book-card { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.book-title { font-size: 20px; font-weight: 700; }
.book-stats { display: flex; gap: 24px; margin: 6px 0; padding-bottom: 12px; border-bottom: 1px solid var(--cj-line); }
.book-stats div { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.book-stats b { font-size: 16px; }
.book-alerts { font-size: 12px; min-height: 20px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.book-links { display: flex; justify-content: center; gap: 4px; }
.create-card { padding: 20px; grid-column: span 2; }
.create-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.create-form .row { display: flex; flex-direction: column; gap: 6px; position: relative; }
.create-form .row.full { grid-column: 1 / -1; }
.create-form label { font-size: 12px; color: var(--cj-sub); }
.create-form :deep(.el-input-number) { width: 100%; }
.unit { position: absolute; right: 44px; bottom: 7px; font-size: 12px; }
.m-shelf { flex: 1; min-height: 0; overflow: auto; padding: 12px 12px 24px; }
.m-shelf-actions { display: flex; gap: 8px; }
.m-shelf-actions .cj-btn { flex: 1; }
.guide-link { color: var(--cj-accent); margin-left: 6px; }
.m-lead { margin: 10px 0 14px; line-height: 1.6; }
.m-book { padding: 4px 14px 14px; margin-bottom: 12px; }
.m-book-open {
  width: 100%;
  min-height: 44px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font: inherit;
  color: inherit;
}
.m-book-open b { font-size: 18px; }
.m-alert { color: var(--cj-sub); font-size: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.m-book-links { display: flex; flex-wrap: wrap; gap: 8px; }
.m-book-links .cj-btn { flex: 1 1 30%; }
.m-create-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
@media (max-width: 768px) {
  .create-card { grid-column: auto; }
  .create-form { grid-template-columns: 1fr; }
}
</style>
