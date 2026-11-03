<template>
  <div class="cj-main" :class="{ 'is-mobile': isMobile }">
    <aside class="set-side">
      <b class="side-title">{{ $t('nav.settings') }}</b>
      <div class="node" :class="{ on: tab === 'model' }" @click="tab = 'model'">{{ $t('shell.settings.modelTab') }}</div>
      <div v-if="bookId" class="node" :class="{ on: tab === 'book' }" @click="tab = 'book'">{{ $t('shell.settings.bookTab') }}</div>
      <div v-if="bookId" class="node" @click="router.push(`/changjuan/book/${bookId}/versions`)">{{ $t('shell.settings.versions') }}</div>
    </aside>

    <div class="cj-page">
      <div v-if="error" class="cj-error-box">{{ error }}</div>
      <div v-else-if="!config" class="cj-empty">{{ $t('shell.settings.loading') }}</div>

      <template v-else-if="tab === 'model'">
        <div v-if="!hasWorkingKey" class="cj-warn-box" style="margin-bottom: 16px">
          <b>{{ $t('shell.settings.firstUseTitle') }}</b>{{ $t('shell.settings.firstUseBody') }}
        </div>
        <div class="two-col">
          <div class="cj-card panel">
            <div class="panel-head"><b>{{ $t('shell.settings.keysTitle') }}</b><div class="cj-spacer"></div><button v-if="config.can_edit && form.providers.length < 5" class="cj-btn sm" @click="addProvider('ark')">{{ $t('shell.settings.addArk') }}</button><button v-if="config.can_edit && form.providers.length < 5" class="cj-btn sm" @click="addProvider()">{{ $t('shell.settings.addProvider') }}</button></div>
            <div v-for="(item, index) in form.providers" :key="item.id" class="provider">
              <div class="provider-head">
                <el-input v-if="config.can_edit" v-model="item.name" size="small" maxlength="30" style="width: 140px" />
                <b v-else>{{ item.name }}</b>
                <span v-if="item.key_storage === 'local'" class="cj-tag amb">{{ $t('shell.settings.storedLocal') }}</span>
                <span class="cj-tag" :class="statusMeta(item).color">{{ statusMeta(item).label }}</span>
                <div class="cj-spacer"></div>
                <button v-if="config.can_edit" class="cj-btn sm ghost danger" @click="removeProvider(index)">{{ $t('shell.settings.remove') }}</button>
              </div>
              <div class="key-row">
                <span class="cj-muted row-label">{{ $t('shell.settings.baseUrl') }}</span>
                <el-input v-model="item.base_url" :disabled="!config.can_edit" placeholder="https://api.example.com/v1" @change="loadProviderModels(item)" />
              </div>
              <div class="key-row">
                <span class="cj-muted row-label">{{ $t('shell.settings.apiKey') }}</span>
                <el-input v-model="item.api_key" :disabled="!config.can_edit" type="password" :show-password="!isMasked(item.api_key)" placeholder="API Key" autocomplete="new-password" @focus="clearMasked(item)" @blur="restoreMasked(item)" />
                <button v-if="config.can_edit" class="cj-btn" :disabled="item.testing" @click="testProvider(item)">{{ item.testing ? $t('shell.settings.testing') : $t('shell.settings.test') }}</button>
              </div>
              <div class="key-row storage-row">
                <span class="cj-muted row-label">{{ $t('shell.settings.storage') }}</span>
                <el-radio-group :model-value="item.key_storage" :disabled="!config.can_edit" @change="value => onStorageChange(item, value)">
                  <el-radio value="server">{{ $t('shell.settings.storageServer') }}</el-radio>
                  <el-radio value="local">{{ $t('shell.settings.storageLocal') }}</el-radio>
                </el-radio-group>
              </div>
              <p v-if="item.key_storage === 'local'" class="storage-note">{{ $t('shell.settings.localNote') }}</p>
              <p v-if="isArkBase(item.base_url)" class="storage-note">{{ $t('shell.settings.arkNoteBefore') }}<a class="ext" href="https://www.volcengine.com/docs/82379/1330310" target="_blank" rel="noopener noreferrer">{{ $t('shell.settings.arkModelList') }}</a>{{ $t('shell.settings.arkNoteAfter') }}</p>
              <div v-if="item.message" class="test-msg" :class="item.ok ? 'ok' : 'bad'">{{ item.message }}</div>
              <div v-if="item.modelsLoading && !isArkBase(item.base_url)" class="cj-muted model-note">{{ $t('shell.settings.modelsLoading') }}</div>
              <div v-else-if="item.modelsError" class="test-msg bad">{{ item.modelsError }}</div>
              <div v-else-if="!isArkBase(item.base_url) && item.models.length" class="cj-muted model-note">{{ $t('shell.settings.modelsReady', { count: item.models.length }) }}{{ item.modelsTruncated ? $t('shell.settings.modelsTruncated') : '' }}</div>
            </div>
            <div v-if="!form.providers.length" class="cj-muted" style="padding: 8px 0">{{ config.can_edit ? $t('shell.settings.noProvidersAdd') : $t('shell.settings.noProviders') }}</div>
            <div class="cj-muted" style="font-size: 12px; margin-top: 8px; line-height: 1.7">{{ $t('shell.settings.keysHelp') }}</div>
          </div>
          <div class="cj-card panel task-panel">
            <div class="panel-head"><b>{{ $t('shell.settings.tasksTitle') }}</b></div>
            <div v-for="(label, task) in config.task_labels" :key="task" class="task-row">
              <div class="task-name"><b>{{ taskTitle(task, label) }}</b><small class="cj-muted">{{ taskHint(task) }}</small></div>
              <el-select v-model="form.tasks[task].provider_id" :disabled="!config.can_edit" :placeholder="$t('shell.settings.providerPlaceholder')" size="small" @change="onTaskProviderChange(task)" popper-class="cj-popper" style="width: 120px">
                <el-option v-for="item in form.providers" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-input v-if="isArkProvider(form.tasks[task].provider_id)" v-model="form.tasks[task].model" :disabled="!config.can_edit" size="small" clearable :placeholder="$t('shell.settings.modelIdPlaceholder')" class="model-code" />
              <el-select v-else v-model="form.tasks[task].model" :disabled="!config.can_edit" filterable allow-create default-first-option clearable size="small" :loading="providerById(form.tasks[task].provider_id)?.modelsLoading" :placeholder="modelPlaceholder(form.tasks[task].provider_id)" popper-class="cj-popper cj-model-popper" class="model-code">
                <el-option v-for="model in modelOptions(task)" :key="model.id" :label="modelLabel(model)" :value="model.id" />
              </el-select>
            </div>
            <div class="cj-muted" style="font-size: 12px; margin-top: 10px; line-height: 1.7">{{ $t('shell.settings.taskHelpBefore') }}<a class="ext" href="https://www.volcengine.com/docs/82379/1330310" target="_blank" rel="noopener noreferrer">{{ $t('shell.settings.modelList') }}</a>{{ $t('shell.settings.taskHelpAfter') }}</div>
          </div>
        </div>
        <div v-if="config.can_edit" class="save-row" style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px">
          <span class="cj-muted" style="align-self: center; font-size: 12px">{{ savedText }}</span>
          <button class="cj-btn pri" :disabled="saving" @click="saveConfig">{{ saving ? $t('shell.settings.saving') : $t('shell.settings.saveModels') }}</button>
        </div>
      </template>

      <template v-else-if="tab === 'book' && book">
        <div class="cj-page-head"><h1>{{ $t('shell.settings.bookTab') }}</h1></div>
        <div class="cj-card panel" style="max-width: 620px">
          <div class="book-row"><span class="cj-muted">{{ $t('shell.settings.bookTitle') }}</span><el-input v-model="bookForm.title" maxlength="60" @change="saveBook" /></div>
          <div class="book-row"><span class="cj-muted">{{ $t('shell.settings.chapterWords') }}</span><el-input-number v-model="bookForm.chapter_words" :min="300" :max="20000" :step="500" controls-position="right" @change="saveBook" /></div>
          <div class="book-row"><span class="cj-muted">{{ $t('shell.settings.foreshadowRemind') }}</span><div><el-input-number v-model="bookForm.foreshadow_remind" :min="0" :max="50" controls-position="right" @change="saveBook" /> <span class="cj-muted">{{ $t('shell.settings.chapterUnit') }}</span></div></div>
          <div class="cj-muted" style="font-size: 12px; text-align: right">{{ bookSavedText }}</div>
        </div>
        <div class="cj-card panel" style="max-width: 620px; margin-top: 16px">
          <b>{{ $t('shell.settings.exportDelete') }}</b>
          <div class="cj-muted" style="font-size: 12px; margin: 6px 0 12px; line-height: 1.8">{{ $t('shell.settings.exportHelp') }}</div>
          <div style="display: flex; gap: 8px">
            <button class="cj-btn" :disabled="exporting" @click="exportBook">{{ exporting ? $t('shell.settings.exporting') : $t('shell.settings.exportBook') }}</button>
            <div class="cj-spacer"></div>
            <button class="cj-btn danger" @click="removeBook">{{ $t('shell.settings.deleteBook') }}</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cjApi, cjDownload, toastError } from './api.js'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { readStoredUser } from '../../utils/authSession.js'
import { maskKey, readLocalKey, removeLocalKey, writeLocalKey } from '../../utils/localProviderKeys.js'

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const { isMobile } = useIsMobile()
const { store, reload, bookId } = inject('cj')

const taskTitle = (task, label) => {
  const key = `shell.settings.taskNames.${task}`
  return te(key) ? t(key) : label
}
const taskHint = (task) => {
  const key = `shell.settings.hints.${task}`
  return te(key) ? t(key) : ''
}

const tab = ref(route.query.tab === 'book' && bookId.value ? 'book' : 'model')
const config = ref(null)
const error = ref('')
const form = reactive({ providers: [], tasks: {} })
const saving = ref(false)
const savedText = ref('')
const bookForm = reactive({ title: '', chapter_words: 2500, foreshadow_remind: 3 })
const bookSavedText = ref('')
const exporting = ref(false)
let newIndex = 0

const book = computed(() => store.book)
const hasSecret = (item) => {
  if (item.key_storage === 'local') return !!(item.local_plain || (!isMasked(item.api_key) && String(item.api_key || '').trim()))
  return !!(item.has_key || (!isMasked(item.api_key) && String(item.api_key || '').trim()))
}
const hasWorkingKey = computed(() => form.providers.some(item => hasSecret(item) && item.status === 'ok'))
const isMasked = (value) => String(value || '').includes('•')

const statusMeta = (item) => {
  if (!hasSecret(item)) return { label: item.key_storage === 'local' ? t('shell.settings.statusLocalEmpty') : t('shell.settings.statusEmpty'), color: 'gray' }
  if (item.dirty) return { label: t('shell.settings.statusUnsaved'), color: 'amb' }
  if (item.status === 'ok') return { label: t('shell.settings.statusOk'), color: 'green' }
  if (item.status === 'error') return { label: `✗ ${item.last_error || t('shell.settings.unavailable')}`, color: 'red' }
  return { label: t('shell.settings.statusUntested'), color: 'gray' }
}

const emptyModelState = () => ({ models: [], modelsLoading: false, modelsError: '', modelsLoaded: false, modelsTruncated: false, modelToken: 0 })

const fillForm = (data) => {
  const previous = form.providers
  config.value = data
  const userId = readStoredUser().id
  form.providers = data.providers.map(item => {
    const local = item.key_storage === 'local'
    const plain = local ? readLocalKey(userId, item.id) : ''
    const shownKey = local ? maskKey(plain) : item.api_key
    const old = previous.find(row => row.id === item.id && row.base_url === item.base_url && row.key_storage === item.key_storage)
    return {
      ...item,
      api_key: shownKey,
      masked: shownKey,
      local_plain: plain,
      has_key: local ? !!plain : item.has_key,
      testing: false,
      message: old?.message || '',
      ok: old?.ok || false,
      dirty: false,
      ...(old?.modelsLoaded ? {
        models: old.models,
        modelsLoading: false,
        modelsError: old.modelsError,
        modelsLoaded: true,
        modelsTruncated: old.modelsTruncated,
        modelToken: old.modelToken
      } : emptyModelState())
    }
  })
  const tasks = {}
  for (const task of Object.keys(data.task_labels)) {
    const item = data.tasks[task] || {}
    tasks[task] = { provider_id: item.provider_id ?? null, model: item.model || '' }
  }
  form.tasks = tasks
  if (data.can_edit) {
    for (const item of form.providers) {
      if (!item.modelsLoaded) loadProviderModels(item)
    }
  }
}

const providerById = (id) => form.providers.find(item => item.id === id)

const onTaskProviderChange = (task) => {
  const row = form.tasks[task]
  if (!row) return
  row.model = ''
}

const modelOptions = (task) => {
  const row = form.tasks[task]
  const list = providerById(row?.provider_id)?.models || []
  const current = String(row?.model || '').trim()
  if (current && !list.some(item => item.id === current)) return [{ id: current, name: '' }, ...list]
  return list
}

const modelLabel = (model) => model.name ? `${model.name} · ${model.id}` : model.id

const ARK_HOST = /^ark\.[a-z0-9-]+\.volces\.com$/i
const isArkBase = (base) => {
  try { return ARK_HOST.test(new URL(base).hostname) } catch { return false }
}
const isArkProvider = (providerId) => isArkBase(providerById(providerId)?.base_url)

const modelPlaceholder = (providerId) => {
  const provider = providerById(providerId)
  if (!provider) return t('shell.settings.pickProviderFirst')
  if (isArkBase(provider.base_url)) return t('shell.settings.modelIdPlaceholder')
  if (provider.modelsLoading) return t('shell.settings.readingModels')
  if (provider.models.length) return t('shell.settings.searchModels')
  return t('shell.settings.enterModel')
}

const applyModelList = (item, data) => {
  item.models = Array.isArray(data?.models) ? data.models : []
  item.modelsTruncated = !!data?.truncated
  item.modelsLoaded = true
  item.modelsError = ''
}

const clearProviderModels = (item) => {
  item.modelToken = (item.modelToken || 0) + 1
  item.models = []
  item.modelsLoading = false
  item.modelsError = ''
  item.modelsLoaded = true
  item.modelsTruncated = false
}

const loadProviderModels = async (item) => {
  if (!config.value?.can_edit) return
  if (isArkBase(item.base_url)) {
    clearProviderModels(item)
    return
  }
  const rawKey = isMasked(item.api_key) ? '' : String(item.api_key || '').trim()
  const hasStoredKey = item.key_storage === 'local' ? !!item.local_plain : (typeof item.id === 'number' && item.has_key)
  if (!item.base_url || (!rawKey && !hasStoredKey)) return
  const token = (item.modelToken = (item.modelToken || 0) + 1)
  item.modelsLoading = true
  item.modelsError = ''
  try {
    const body = { base_url: item.base_url, api_key: rawKey }
    if (typeof item.id === 'number') body.id = item.id
    const json = await cjApi('/config/models', { method: 'POST', body })
    if (item.modelToken !== token) return
    applyModelList(item, json.data)
  } catch (err) {
    if (item.modelToken !== token) return
    item.modelsLoaded = true
    item.modelsError = err.message
  } finally {
    if (item.modelToken === token) item.modelsLoading = false
  }
}

const loadConfig = async () => {
  error.value = ''
  try {
    const json = await cjApi('/config')
    fillForm(json.data)
  } catch (err) {
    error.value = err.message
  }
}

// 聚焦已脱敏的密钥框时清空，方便重新输入；没输入就失焦则恢复原样（保存时保留旧密钥）
const clearMasked = (item) => { if (isMasked(item.api_key)) item.api_key = '' }
const restoreMasked = (item) => {
  if (!item.api_key && item.masked) item.api_key = item.masked
  else if (item.api_key !== item.masked) {
    item.dirty = true
    if (!isMasked(item.api_key)) item.local_plain = String(item.api_key || '').trim()
    loadProviderModels(item)
  }
}

const onStorageChange = async (item, value) => {
  if (item.storageSilent || value === item.key_storage) return
  const previous = item.key_storage
  const toLocal = value === 'local'
  const message = toLocal
    ? t('shell.settings.toLocalBody')
    : t('shell.settings.toServerBody')
  try {
    await ElMessageBox.confirm(message, toLocal ? t('shell.settings.toLocalTitle') : t('shell.settings.toServerTitle'), {
      confirmButtonText: t('shell.settings.confirm'), cancelButtonText: t('shell.settings.cancel'), type: 'warning'
    })
  } catch {
    return
  }
  item.key_storage = value
  item.dirty = true
  if (toLocal && isMasked(item.api_key) && previous !== 'local') {
    item.api_key = ''
    item.masked = ''
    item.has_key = false
    item.local_plain = ''
  }
}

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

const addProvider = (preset) => {
  const ark = preset === 'ark'
  const letter = String.fromCharCode(65 + form.providers.length)
  form.providers.push({
    id: `new-${newIndex++}`,
    name: ark ? t('shell.settings.arkName') : t('shell.settings.providerName', { letter }),
    base_url: ark ? ARK_BASE_URL : '',
    api_key: '',
    masked: '',
    has_key: false,
    key_storage: 'server',
    local_plain: '',
    status: 'unknown',
    testing: false,
    message: '',
    ok: false,
    dirty: true,
    ...emptyModelState()
  })
}

const pendingLocalRemoval = []

const removeProvider = (index) => {
  const [removed] = form.providers.splice(index, 1)
  if (typeof removed.id === 'number') pendingLocalRemoval.push(removed.id)
  for (const task of Object.values(form.tasks)) {
    if (task.provider_id === removed.id) task.provider_id = null
  }
}

const plainForSave = (item) => {
  if (!isMasked(item.api_key) && String(item.api_key || '').trim()) return String(item.api_key).trim()
  return item.local_plain || ''
}

const testProvider = async (item) => {
  item.testing = true
  item.message = ''
  try {
    const body = { base_url: item.base_url, api_key: isMasked(item.api_key) ? '' : item.api_key }
    if (typeof item.id === 'number') body.id = item.id
    const model = Object.values(form.tasks).find(task => task.provider_id === item.id && task.model)?.model
    if (model) body.model = model
    const json = await cjApi('/config/test', { method: 'POST', body })
    item.ok = true
    item.message = json.message
    if (isArkBase(item.base_url)) clearProviderModels(item)
    else if (Array.isArray(json.data?.models)) applyModelList(item, json.data)
    if (!item.dirty && typeof item.id === 'number') item.status = 'ok'
  } catch (err) {
    item.ok = false
    item.message = err.message
    if (!item.dirty && typeof item.id === 'number') {
      item.status = 'error'
      item.last_error = err.message
    }
  } finally {
    item.testing = false
  }
}

const saveConfig = async () => {
  saving.value = true
  savedText.value = ''
  try {
    const userId = readStoredUser().id
    const keptLocal = form.providers.map(item => (item.key_storage === 'local' ? plainForSave(item) : ''))
    const providers = form.providers.map(item => {
      const local = item.key_storage === 'local'
      let apiKey = ''
      if (!local) apiKey = isMasked(item.api_key) && item.local_plain ? item.local_plain : item.api_key
      return { id: item.id, name: item.name, base_url: item.base_url, api_key: apiKey, key_storage: local ? 'local' : 'server' }
    })
    const json = await cjApi('/config', { method: 'PUT', body: { providers, tasks: form.tasks } })
    json.data.providers.forEach((item, index) => {
      if (item.key_storage === 'local' && keptLocal[index]) writeLocalKey(userId, item.id, keptLocal[index])
      else removeLocalKey(userId, item.id)
    })
    for (const id of pendingLocalRemoval) removeLocalKey(userId, id)
    pendingLocalRemoval.length = 0
    fillForm(json.data)
    savedText.value = t('shell.settings.saved')
    ElMessage.success(t('shell.settings.saved'))
  } catch (err) {
    toastError(err)
  } finally {
    saving.value = false
  }
}

const fillBook = () => {
  if (!book.value) return
  Object.assign(bookForm, { title: book.value.title, chapter_words: book.value.chapter_words, foreshadow_remind: book.value.foreshadow_remind })
}
watch(book, fillBook, { immediate: true })

const saveBook = async () => {
  if (!bookForm.title.trim()) return ElMessage.warning(t('shell.settings.titleRequired'))
  bookSavedText.value = t('shell.settings.saving')
  try {
    await cjApi(`/books/${bookId.value}`, { method: 'PUT', body: { ...bookForm } })
    bookSavedText.value = t('shell.settings.saved')
    await reload()
  } catch (err) {
    bookSavedText.value = ''
    toastError(err)
  }
}

const exportBook = async () => {
  exporting.value = true
  try {
    const name = await cjDownload(`/books/${bookId.value}/export`, `${book.value.title}.zip`)
    ElMessage.success(t('shell.settings.exported', { name }))
  } catch (err) {
    toastError(err)
  } finally {
    exporting.value = false
  }
}

const removeBook = async () => {
  try {
    await ElMessageBox.prompt(t('shell.settings.deletePrompt', { title: book.value.title }), t('shell.settings.deleteBook'), {
      confirmButtonText: t('shell.settings.delete'), cancelButtonText: t('shell.settings.cancel'), type: 'warning',
      inputValidator: value => value === book.value.title || t('shell.settings.titleMismatch')
    })
  } catch {
    return
  }
  try {
    await cjApi(`/books/${bookId.value}`, { method: 'DELETE' })
    ElMessage.success(t('shell.settings.deleted'))
    router.push('/changjuan')
  } catch (err) {
    toastError(err)
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.cj-main { flex: 1; display: flex; min-height: 0; }
.set-side { width: 200px; background: var(--cj-paper); border-right: 1px solid var(--cj-line); padding: 14px 10px; flex-shrink: 0; }
.side-title { display: block; padding: 0 8px 10px; }
.node { padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.node:hover { background: #f7f3ed; }
.node.on { background: var(--cj-gray-soft); font-weight: 600; }
.two-col { display: grid; grid-template-columns: 1fr 1.2fr; gap: 16px; align-items: start; }
.panel { padding: 16px 18px; }
.panel-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.provider { padding: 10px 0 12px; border-bottom: 1px solid var(--cj-line); }
.provider:last-of-type { border-bottom: none; }
.provider-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.provider-head .cj-tag { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.key-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.row-label { width: 56px; flex-shrink: 0; font-size: 12px; }
.storage-row { align-items: flex-start; }
.storage-row :deep(.el-radio) { margin-right: 12px; height: auto; }
.storage-note { margin: 0 0 6px 64px; font-size: 12px; line-height: 1.6; color: var(--cj-sub); }
.test-msg { font-size: 12px; margin-top: 4px; padding-left: 64px; line-height: 1.6; word-break: break-all; }
.test-msg.ok { color: var(--cj-green); }
.test-msg.bad { color: var(--cj-red); }
.task-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--cj-line); flex-wrap: wrap; }
.task-name { width: 168px; display: flex; flex-direction: column; }
.model-code { width: 260px; }
.model-note { font-size: 12px; margin-top: 4px; line-height: 1.6; }
.ext { color: var(--cj-accent); text-decoration: underline; text-underline-offset: 2px; }
.task-name small { font-size: 11px; }
.book-row { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 10px; margin-bottom: 14px; }
@media (max-width: 960px) {
  .two-col { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .cj-main { flex-direction: column; overflow-y: auto; }
  .set-side { width: 100%; display: flex; gap: 4px; align-items: center; border-right: none; border-bottom: 1px solid var(--cj-line); }
  .side-title { padding: 0 8px; }
}
.cj-main.is-mobile { flex-direction: column; overflow: auto; }
.cj-main.is-mobile .set-side { width: 100%; display: flex; gap: 8px; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--cj-line); }
.cj-main.is-mobile .node { min-height: 44px; display: flex; align-items: center; white-space: nowrap; }
.cj-main.is-mobile .two-col { grid-template-columns: 1fr; }
.cj-main.is-mobile .task-panel { background: transparent; border: none; padding: 0; box-shadow: none; }
.cj-main.is-mobile .task-row {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  background: var(--cj-paper);
  border: 1px solid var(--cj-line);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}
.cj-main.is-mobile .task-name { width: auto; }
.cj-main.is-mobile .task-row :deep(.el-select),
.cj-main.is-mobile .model-code { width: 100% !important; }
.cj-main.is-mobile .key-row { flex-wrap: wrap; }
.cj-main.is-mobile .row-label { width: 100%; }
.cj-main.is-mobile .storage-note,
.cj-main.is-mobile .test-msg { margin-left: 0; padding-left: 0; }
.cj-main.is-mobile .provider-head { flex-wrap: wrap; }
.cj-main.is-mobile .provider-head :deep(.el-input) { width: auto !important; flex: 1; min-width: 120px; }
.cj-main.is-mobile .book-row { grid-template-columns: 1fr; }
.cj-main.is-mobile .save-row { flex-direction: column; align-items: stretch !important; }
.cj-main.is-mobile .panel { max-width: none !important; }
</style>
