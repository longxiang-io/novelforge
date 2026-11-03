<template>
  <div class="cj-page" :class="{ 'is-mobile': isMobile }">
    <div class="cj-page-head">
      <div>
        <h1>{{ $t('write.foreshadow.title') }}</h1>
        <div class="cj-muted" style="margin-top: 6px">{{ $t('write.foreshadow.progress', { current: data.current_chapter || 0, remind: data.remind || 0 }) }}</div>
      </div>
      <div class="cj-spacer"></div>
      <button class="cj-btn" @click="openEditor(null)">＋ {{ $t('write.foreshadow.add') }}</button>
    </div>
    <div v-if="error" class="cj-error-box">{{ error }}</div>
    <template v-else>
      <div class="stat-grid">
        <div class="cj-card stat"><span class="cj-muted">{{ $t('write.foreshadow.overdueStat') }}</span><b style="color: var(--cj-red)">{{ stats.overdue ?? 0 }}</b></div>
        <div class="cj-card stat"><span class="cj-muted">{{ $t('write.foreshadow.dueWithin', { count: data.remind || 0 }) }}</span><b style="color: var(--cj-amber)">{{ stats.due_soon ?? 0 }}</b></div>
        <div class="cj-card stat"><span class="cj-muted">{{ $t('write.foreshadow.open') }}</span><b>{{ stats.open ?? 0 }}</b></div>
        <div class="cj-card stat"><span class="cj-muted">{{ $t('write.foreshadow.resolved') }}</span><b style="color: var(--cj-green)">{{ stats.resolved ?? 0 }}</b></div>
        <div class="cj-card stat"><span class="cj-muted">{{ $t('write.foreshadow.rate') }}</span><b>{{ percent(stats.rate) }}</b></div>
      </div>
      <div class="filters">
        <button v-for="item in filters" :key="item.key" class="cj-btn sm" :class="{ on: filter === item.key }" @click="filter = item.key">{{ item.label }}</button>
        <div class="cj-spacer"></div>
        <el-select v-model="person" clearable :placeholder="$t('write.foreshadow.filterByCharacter')" size="small" popper-class="cj-popper" style="width: 140px">
          <el-option v-for="name in people" :key="name" :label="name" :value="name" />
        </el-select>
      </div>
      <div v-if="isMobile" class="fs-list">
        <button v-for="item in rows" :id="`fs-${item.id}`" :key="item.id" type="button" class="fs-item" :class="{ on: item.id === focusedId }" @click="openEditor(item)">
          <span class="fs-item-top"><b>{{ item.code }}</b><span class="cj-tag" :class="stateMeta(item).color">{{ stateMeta(item).label }}</span></span>
          <span class="fs-content">{{ item.content }}</span>
          <span class="cj-muted fs-meta">
            {{ item.planted_chapter ? $t('write.foreshadow.plantedAt', { number: item.planted_chapter }) : $t('write.foreshadow.notPlanted') }}
            · {{ item.planned_chapter ? $t('write.foreshadow.plannedAt', { number: item.planned_chapter }) : $t('write.foreshadow.notPlanned') }}
          </span>
        </button>
        <div v-if="!rows.length" class="cj-empty">{{ loading ? $t('rest.read.loading') : $t('write.foreshadow.empty') }}</div>
      </div>
      <div v-else class="cj-card table-wrap">
        <table class="fs-table">
          <thead>
            <tr>
              <th style="width: 70px">{{ $t('write.foreshadow.code') }}</th><th>{{ $t('rest.chat.contentPh') }}</th><th style="width: 130px">{{ $t('write.foreshadow.characters') }}</th><th style="width: 80px">{{ $t('write.foreshadow.planted') }}</th><th style="width: 90px">{{ $t('write.foreshadow.planned') }}</th><th style="width: 90px">{{ $t('write.foreshadow.status') }}</th>
              <th style="width: 220px">{{ $t('write.foreshadow.timeline', { max: data.max_chapter }) }}</th><th style="width: 110px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :id="`fs-${item.id}`" :key="item.id" :class="{ on: item.id === focusedId }">
              <td><b>{{ item.code }}</b></td>
              <td>{{ item.content }}</td>
              <td><span v-for="name in item.characters" :key="name" class="cj-tag gray" style="margin: 0 4px 2px 0">{{ name }}</span></td>
              <td>{{ item.planted_chapter ? $t('rest.context.chapter', { number: item.planted_chapter }) : '—' }}</td>
              <td>{{ item.planned_chapter ? $t('rest.context.chapter', { number: item.planned_chapter }) : '—' }}</td>
              <td><span class="cj-tag" :class="stateMeta(item).color">{{ stateMeta(item).label }}</span></td>
              <td>
                <div class="timeline">
                  <div class="bar" :class="stateMeta(item).color" :style="barStyle(item)"></div>
                  <div v-if="item.planned_chapter" class="mark" :style="{ left: pos(item.planned_chapter) }"></div>
                </div>
              </td>
              <td class="actions">
                <el-dropdown trigger="click" popper-class="cj-popper" @command="cmd => handleCommand(cmd, item)">
                  <button class="cj-btn sm ghost">{{ $t('write.foreshadow.actions') }} ▾</button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">{{ $t('write.common.edit') }}</el-dropdown-item>
                      <el-dropdown-item v-if="item.status !== 'resolved'" command="resolve">{{ $t('write.foreshadow.markResolved') }}</el-dropdown-item>
                      <el-dropdown-item v-if="item.status === 'open'" command="abandon">{{ $t('write.foreshadow.abandon') }}</el-dropdown-item>
                      <el-dropdown-item v-if="item.status !== 'open'" command="reopen">{{ $t('write.foreshadow.reopen') }}</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>{{ $t('rest.stats.delete') }}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </td>
            </tr>
            <tr v-if="!rows.length"><td colspan="8" class="cj-empty">{{ loading ? $t('rest.read.loading') : $t('write.foreshadow.empty') }}</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <el-dialog v-model="editorVisible" :title="editing.id ? $t('write.foreshadow.editNamed', { code: editing.code }) : $t('write.foreshadow.add')" width="480px" :fullscreen="isMobile" class="cj-dialog" append-to-body>
      <div class="cj-form-row"><label>{{ $t('rest.chat.contentPh') }}</label><el-input v-model="editing.content" type="textarea" :rows="3" maxlength="500" /></div>
      <div class="cj-form-row">
        <label>{{ $t('write.foreshadow.characters') }}</label>
        <el-select v-model="editing.characters" multiple filterable allow-create default-first-option popper-class="cj-popper" style="width: 100%">
          <el-option v-for="name in characterNames" :key="name" :label="name" :value="name" />
        </el-select>
      </div>
      <div class="fs-numbers">
        <div class="cj-form-row" style="flex: 1"><label>{{ $t('write.foreshadow.plantedChapter') }}</label><el-input-number v-model="editing.planted_chapter" :min="1" controls-position="right" style="width: 100%" /></div>
        <div class="cj-form-row" style="flex: 1"><label>{{ $t('write.foreshadow.payoffChapter') }}</label><el-input-number v-model="editing.planned_chapter" :min="1" controls-position="right" style="width: 100%" /></div>
      </div>
      <div class="cj-form-row"><label>{{ $t('write.foreshadow.note') }}</label><el-input v-model="editing.note" maxlength="500" /></div>
      <div v-if="isMobile && editing.id" class="m-fs-actions">
        <button v-if="editing.status !== 'resolved'" type="button" class="cj-btn" @click="runCommand('resolve')">{{ $t('write.foreshadow.markResolved') }}</button>
        <button v-if="editing.status === 'open'" type="button" class="cj-btn" @click="runCommand('abandon')">{{ $t('write.foreshadow.abandon') }}</button>
        <button v-if="editing.status !== 'open'" type="button" class="cj-btn" @click="runCommand('reopen')">{{ $t('write.foreshadow.reopen') }}</button>
        <button type="button" class="cj-btn danger" @click="runCommand('delete')">{{ $t('rest.stats.delete') }}</button>
      </div>
      <template #footer>
        <div class="cj-dialog-footer">
          <button class="cj-btn" @click="editorVisible = false">{{ $t('rest.stats.cancel') }}</button>
          <button class="cj-btn pri" @click="save">{{ $t('rest.stats.save') }}</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { cjApi, percent, toastError } from './api.js'

const route = useRoute()
const { t } = useI18n()
const { isMobile } = useIsMobile()
const { bookId } = inject('cj')
const focusedId = computed(() => Number(route.query.id) || 0)
const filters = computed(() => [
  { key: 'open', label: t('write.foreshadow.open') },
  { key: 'resolved', label: t('write.foreshadow.resolved') },
  { key: 'abandoned', label: t('write.foreshadow.abandoned') },
  { key: 'all', label: t('write.foreshadow.all') }
])

const data = ref({ list: [], stats: {}, current_chapter: 0, remind: 0, max_chapter: 10 })
const loading = ref(true)
const error = ref('')
const filter = ref('all')
const person = ref('')
const characterNames = ref([])
const editorVisible = ref(false)
const editing = ref({})

const stats = computed(() => data.value.stats || {})
const people = computed(() => [...new Set(data.value.list.flatMap(item => item.characters))])
const rows = computed(() => data.value.list
  .filter(item => filter.value === 'all' || item.status === filter.value)
  .filter(item => !person.value || item.characters.includes(person.value))
  .sort((a, b) => order(a) - order(b) || (a.planned_chapter || 9999) - (b.planned_chapter || 9999)))
const order = (item) => ({ overdue: 0, due_soon: 1, open: 2, resolved: 3, abandoned: 4 }[item.state] ?? 5)

const stateMeta = (item) => {
  if (item.state === 'overdue') return { label: t('write.foreshadow.overdueBy', { count: -item.remaining }), color: 'red' }
  if (item.state === 'due_soon') return { label: item.remaining ? t('write.foreshadow.remaining', { count: item.remaining }) : t('write.foreshadow.dueThisChapter'), color: 'amb' }
  if (item.status === 'resolved') return { label: t('write.foreshadow.resolved'), color: 'green' }
  if (item.status === 'abandoned') return { label: t('write.foreshadow.abandoned'), color: 'gray' }
  return { label: t('write.foreshadow.open'), color: 'gray' }
}

const pos = (chapter) => `${Math.min(100, Math.max(0, ((chapter - 1) / Math.max(1, data.value.max_chapter - 1)) * 100))}%`
const barStyle = (item) => {
  const start = item.planted_chapter || 1
  const end = item.status === 'resolved' ? (item.resolved_chapter || item.planned_chapter || start) : Math.max(start, data.value.current_chapter || start)
  const left = parseFloat(pos(start))
  return { left: `${left}%`, width: `${Math.max(2, parseFloat(pos(end)) - left)}%` }
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [json, cards] = await Promise.all([cjApi(`/books/${bookId.value}/foreshadows`), cjApi(`/books/${bookId.value}/cards?kind=character`)])
    data.value = json.data
    characterNames.value = cards.data.cards.map(card => card.name)
    showFocused()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const runCommand = async (command) => {
  const item = editing.value
  editorVisible.value = false
  await handleCommand(command, item)
}

const showFocused = () => {
  const id = focusedId.value
  if (!id || !data.value.list?.some(item => item.id === id)) return
  filter.value = 'all'
  nextTick(() => document.getElementById(`fs-${id}`)?.scrollIntoView({ block: 'center' }))
}

const openEditor = (item) => {
  editing.value = item
    ? { ...item, characters: [...item.characters] }
    : { content: '', characters: [], planted_chapter: data.value.current_chapter || null, planned_chapter: null, note: '' }
  editorVisible.value = true
}

const save = async () => {
  const item = editing.value
  if (!item.content?.trim()) return ElMessage.warning(t('write.foreshadow.contentRequired'))
  try {
    const body = { book_id: bookId.value, content: item.content, characters: item.characters, planted_chapter: item.planted_chapter, planned_chapter: item.planned_chapter, note: item.note }
    const json = item.id ? await cjApi(`/foreshadows/${item.id}`, { method: 'PUT', body }) : await cjApi('/foreshadows', { method: 'POST', body })
    ElMessage.success(json.message)
    editorVisible.value = false
    load()
  } catch (err) {
    toastError(err)
  }
}

const handleCommand = async (command, item) => {
  if (command === 'edit') return openEditor(item)
  try {
    if (command === 'delete') {
      await ElMessageBox.confirm(t('write.foreshadow.deleteMessage', { code: item.code }), t('write.foreshadow.deleteTitle'), { confirmButtonText: t('rest.stats.delete'), cancelButtonText: t('rest.stats.cancel'), type: 'warning' })
      await cjApi(`/foreshadows/${item.id}`, { method: 'DELETE' })
    } else if (command === 'resolve') {
      const { value } = await ElMessageBox.prompt(t('write.foreshadow.resolvePrompt'), t('write.foreshadow.resolveTitle', { code: item.code }), { inputValue: String(data.value.current_chapter || ''), inputPattern: /^\d+$/, inputErrorMessage: t('write.foreshadow.chapterNumber'), confirmButtonText: t('shell.settings.confirm'), cancelButtonText: t('rest.stats.cancel') })
      await cjApi(`/foreshadows/${item.id}`, { method: 'PUT', body: { status: 'resolved', resolved_chapter: Number(value) } })
    } else {
      await cjApi(`/foreshadows/${item.id}`, { method: 'PUT', body: { status: command === 'abandon' ? 'abandoned' : 'open' } })
    }
    load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') toastError(err)
  }
}

watch(focusedId, showFocused)
onMounted(load)
</script>

<style scoped>
.stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 16px; }
.stat { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.stat span { font-size: 12px; }
.stat b { font-size: 24px; }
.filters { display: flex; gap: 6px; margin-bottom: 12px; align-items: center; }
.filters .cj-btn.on { background: var(--cj-ink); color: #fff; border-color: var(--cj-ink); }
.table-wrap { overflow-x: auto; }
.fs-table { width: 100%; border-collapse: collapse; min-width: 960px; }
.fs-table th { text-align: left; font-size: 12px; color: var(--cj-sub); font-weight: 500; padding: 12px; border-bottom: 1px solid var(--cj-line); background: #fbf8f3; }
.fs-table td { padding: 12px; border-bottom: 1px solid var(--cj-line); vertical-align: middle; }
.fs-table tr:last-child td { border-bottom: none; }
.timeline { position: relative; height: 6px; background: var(--cj-gray-soft); border-radius: 3px; }
.bar { position: absolute; top: 0; height: 6px; border-radius: 3px; background: #a99f92; }
.bar.red { background: #d77b6e; }
.bar.amb { background: #d5a35a; }
.bar.green { background: #6aa784; }
.mark { position: absolute; top: -4px; width: 2px; height: 14px; background: var(--cj-ink); }
.actions { text-align: right; }
@media (max-width: 960px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
.cj-page.is-mobile .filters { flex-wrap: wrap; max-width: 100%; }
.cj-page.is-mobile .filters .cj-btn { flex: 1 1 auto; }
.cj-page.is-mobile .filters :deep(.el-select) { width: 100% !important; flex: 1 1 100%; }
.fs-list { display: flex; flex-direction: column; gap: 8px; }
.fs-table tr.on td { background: #f8f1e6; }
.fs-item.on { border-color: var(--cj-accent); }
.fs-item {
  width: 100%;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--cj-line);
  border-radius: 12px;
  background: var(--cj-paper);
  color: inherit;
  font: inherit;
  text-align: left;
}
.fs-item-top { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; }
.fs-content { line-height: 1.6; }
.fs-meta { font-size: 12px; }
.m-fs-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.fs-numbers { display: flex; gap: 12px; }
@media (max-width: 768px) {
  .fs-numbers { flex-direction: column; }
}
</style>
