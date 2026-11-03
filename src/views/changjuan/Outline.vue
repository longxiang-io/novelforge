<template>
  <div class="cj-main" :class="{ 'is-mobile': isMobile }">
    <div v-if="isMobile && mobilePane === 'root'" class="m-outline">
      <div class="m-block">
        <button type="button" class="m-row" @click="editBookField('world')"><b>{{ $t('rest.chat.world') }}</b><small>{{ $t('write.outline.injectedEveryChapter') }}</small></button>
        <button type="button" class="m-row" @click="editBookField('outline')"><b>{{ $t('write.outline.overall') }}</b><small>{{ $t('write.outline.storyDirection') }}</small></button>
      </div>
      <div class="m-block">
        <button v-for="group in groups" :key="group.key" type="button" class="m-row" @click="openVolumeList(group)">
          <b>{{ group.volume ? group.volume.title : $t('rest.sidebar.unvolumed') }}</b>
          <small>{{ $t('write.outline.chapters', { count: group.chapters.length }) }}<template v-if="group.volume?.goal"> · {{ group.volume.goal }}</template></small>
        </button>
      </div>
      <button type="button" class="cj-btn block" @click="addVolume">＋ {{ $t('write.outline.addVolume') }}</button>
    </div>

    <div v-else-if="isMobile && mobilePane === 'volume'" class="m-outline">
      <div class="m-subhead">
        <b>{{ mobileGroup?.volume?.title || $t('rest.sidebar.unvolumed') }}</b>
        <span class="cj-muted">{{ $t('write.outline.chapters', { count: mobileGroup?.chapters.length || 0 }) }}</span>
      </div>
      <div class="m-block">
        <button v-if="mobileGroup?.volume" type="button" class="m-row" @click="editVolume"><b>{{ $t('write.outline.thisVolume') }}</b><small>{{ mobileGroup.volume.goal || $t('write.outline.volumeGoalHint') }}</small></button>
        <button v-for="item in mobileGroup?.chapters || []" :key="item.id" type="button" class="m-row" @click="editChapter(item.id)">
          <b>{{ pad3(item.number) }} {{ item.title }}</b>
          <small>{{ chapterListHint(item) }}</small>
        </button>
      </div>
      <button type="button" class="cj-btn block" @click="addChapterMobile">＋ {{ $t('write.outline.addChapter') }}</button>
    </div>

    <aside v-if="!isMobile" class="tree">
      <div class="tree-head">
        <b>{{ $t('nav.outline') }}</b>
        <div class="cj-spacer"></div>
        <button class="cj-btn sm" @click="addChapter">＋ {{ $t('write.outline.addChapter') }}</button>
      </div>
      <div class="node" :class="{ on: selected.type === 'world' }" @click="select('world')">🌏 {{ $t('rest.chat.world') }}</div>
      <div class="node" :class="{ on: selected.type === 'outline' }" @click="select('outline')">📁 {{ $t('write.outline.overall') }}</div>
      <template v-for="group in groups" :key="group.key">
        <div class="node" :class="{ on: selected.type === 'volume' && selected.id === group.volume?.id }" @click="group.volume && select('volume', group.volume.id)">
          📁 {{ group.volume ? group.volume.title : $t('rest.sidebar.unvolumed') }}<template v-if="group.volume?.goal"> · {{ group.volume.goal }}</template>
          <span v-if="!group.chapters.length" class="cj-muted"> · {{ $t('write.outline.notWritten') }}</span>
        </div>
        <div v-for="item in group.chapters" :key="item.id" class="node child" :class="{ on: selected.type === 'chapter' && selected.id === item.id }" @click="select('chapter', item.id)">
          <span class="cj-dot" :class="item.dot"></span> {{ pad3(item.number) }} {{ item.title }}
        </div>
      </template>
      <button class="cj-btn sm ghost block" style="margin-top: 8px" @click="addVolume">＋ {{ $t('write.outline.addVolume') }}</button>
    </aside>

    <div v-show="!isMobile || mobilePane === 'edit'" class="cj-page">
      <div v-if="!store.book" class="cj-empty">{{ $t('rest.read.loading') }}</div>

      <template v-else-if="selected.type === 'world' || selected.type === 'outline'">
        <div class="cj-page-head">
          <div>
            <div class="cj-muted" style="font-size: 12px">{{ selected.type === 'world' ? $t('write.outline.worldInjectNote') : $t('write.outline.bookOutlineNote') }}</div>
            <h1>{{ selected.type === 'world' ? $t('rest.chat.world') : $t('write.outline.overall') }}</h1>
          </div>
          <div class="cj-spacer"></div>
          <span class="cj-muted save-state">{{ bookSaveText }}</span>
          <button v-if="bookBlank" class="cj-btn sm" @click="askFill">{{ $t('rest.chat.fill') }}</button>
          <button class="cj-btn sm" @click="chatOpen = true">{{ $t('rest.chat.heading') }}</button>
        </div>
        <el-input v-model="bookText" type="textarea" :autosize="{ minRows: 18, maxRows: 40 }" class="md-editor" :placeholder="$t('write.outline.markdown')" @input="scheduleBookSave" />
      </template>

      <template v-else-if="selected.type === 'volume' && activeVolume">
        <div class="cj-page-head">
          <div><div class="cj-muted" style="font-size: 12px">{{ $t('rest.chat.volumeOutlinePh') }}</div><h1>{{ activeVolume.title }}</h1></div>
          <div class="cj-spacer"></div>
          <span class="cj-muted save-state">{{ volumeSaveText }}</span>
          <button v-if="volumeBlank" class="cj-btn sm" @click="askFill">{{ $t('rest.chat.fill') }}</button>
          <button class="cj-btn sm" @click="chatOpen = true">{{ $t('rest.chat.heading') }}</button>
          <button class="cj-btn sm ghost danger" @click="removeVolume">{{ $t('write.outline.deleteVolume') }}</button>
        </div>
        <div class="volume-form">
          <div class="field"><label>{{ $t('rest.chat.volumeTitlePh') }}</label><el-input v-model="volumeForm.title" maxlength="60" @change="saveVolume" /></div>
          <div class="field"><label>{{ $t('rest.context.volumeGoal') }}</label><el-input v-model="volumeForm.goal" maxlength="2000" @change="saveVolume" /></div>
          <div class="field"><label>{{ $t('rest.chat.volumeOutlinePh') }}</label><el-input v-model="volumeForm.outline" type="textarea" :autosize="{ minRows: 14, maxRows: 40 }" class="md-editor" :placeholder="$t('write.outline.markdown')" @change="saveVolume" /></div>
        </div>
      </template>

      <template v-else-if="selected.type === 'chapter'">
        <div v-if="chapterError" class="cj-error-box">{{ chapterError }}</div>
        <div v-else-if="!chapter" class="cj-empty">{{ $t('rest.read.loading') }}</div>
        <template v-else>
          <div class="cj-page-head">
            <div>
              <div class="cj-muted" style="font-size: 12px">{{ $t('write.outline.chapterInVolume', { volume: volumeTitle(chapter.volume_id) }) }}</div>
              <h1>{{ pad3(chapter.number) }} {{ chapter.title }}</h1>
            </div>
            <div class="cj-spacer"></div>
            <el-select :model-value="chapter.volume_id" size="small" :placeholder="$t('write.outline.volume')" popper-class="cj-popper" style="width: 120px" @change="moveChapter">
              <el-option v-for="volume in store.volumes" :key="volume.id" :label="volume.title" :value="volume.id" />
            </el-select>
            <button v-if="chapterBlank" class="cj-btn sm" @click="askFill">{{ $t('rest.chat.fill') }}</button>
            <button class="cj-btn sm" @click="chatOpen = true">{{ $t('rest.chat.heading') }}</button>
            <button v-if="chapter.status !== 'confirmed'" class="cj-btn sm ghost danger" @click="removeChapter">{{ $t('write.outline.deleteChapter') }}</button>
            <button class="cj-btn pri" @click="router.push(`/changjuan/book/${bookId}/write/${chapter.id}`)">{{ chapter.content ? $t('rest.read.goWrite') : $t('write.outline.generateChapter') }}</button>
          </div>
          <div class="chapter-grid">
            <div class="cj-card" style="padding: 18px 20px">
              <OutlineForm :key="chapterFormKey" :chapter="chapter" :book-id="bookId" :default-words="store.book.chapter_words || 2500" @saved="onChapterSaved" />
            </div>
            <div class="side">
              <div class="cj-card side-card">
                <b>{{ $t('rest.outlineForm.words') }}</b>
                <div style="margin-top: 8px">{{ $t('rest.read.words', { count: numberText(chapter.target_words || store.book.chapter_words) }) }}<span v-if="!chapter.target_words" class="cj-muted">{{ $t('write.outline.usesBookDefault') }}</span></div>
                <div v-if="chapter.content" class="cj-muted" style="margin-top: 6px; font-size: 12px">{{ $t('write.outline.currentText', { words: numberText(chapter.word_count) }) }}</div>
              </div>
              <div class="cj-card side-card">
                <b>{{ $t('write.outline.changedTitle') }}</b>
                <div class="cj-muted" style="margin-top: 6px; font-size: 12px; line-height: 1.8">{{ $t('write.outline.changedBody') }}</div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
    <AiChatPanel v-if="chatOpen && chatTarget" :key="chatTarget.key" :book-id="bookId" :target-type="chatTarget.targetType" :target-id="chatTarget.targetId" :heading="chatTarget.heading" :show-fill="chatTarget.showFill" :fill-prompt="chatTarget.fillPrompt" :fill-tick="fillTick" @close="chatOpen = false" @applied="onAiApplied" />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import OutlineForm from './components/OutlineForm.vue'
import AiChatPanel from './components/AiChatPanel.vue'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { DEFAULT_OUTLINE, DEFAULT_WORLD } from '../../../worker/lib/book-defaults.js'
import { cjApi, numberText, pad3, toastError } from './api.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isMobile } = useIsMobile()
const { store, reload, bookId, mobileBack } = inject('cj')

const selected = ref({ type: 'outline', id: 0 })
const mobilePane = ref('root')
const mobileVolumeKey = ref('')
const chapter = ref(null)
const chapterError = ref('')
const bookText = ref('')
const bookSaveStatus = ref('')
const volumeForm = reactive({ title: '', goal: '', outline: '' })
const volumeSaveStatus = ref('')
const chatOpen = ref(false)
const fillTick = ref(0)
const chapterFormKey = ref(0)
let bookTimer = null

const saveLabel = (status) => {
  if (status === 'saving') return t('rest.outlineForm.saving')
  if (status === 'saved') return t('rest.outlineForm.saved')
  if (status === 'failed') return t('write.common.saveFailed')
  if (status === 'editing') return t('write.common.editing')
  return ''
}
const bookSaveText = computed(() => saveLabel(bookSaveStatus.value))
const volumeSaveText = computed(() => saveLabel(volumeSaveStatus.value))

const groups = computed(() => {
  const list = store.volumes.map(volume => ({ key: `v${volume.id}`, volume, chapters: store.chapters.filter(item => item.volume_id === volume.id) }))
  const loose = store.chapters.filter(item => !store.volumes.some(volume => volume.id === item.volume_id))
  if (loose.length) list.push({ key: 'loose', volume: null, chapters: loose })
  return list
})
const activeVolume = computed(() => store.volumes.find(item => item.id === selected.value.id) || null)
const mobileGroup = computed(() => groups.value.find(item => item.key === mobileVolumeKey.value) || null)
const volumeTitle = (id) => store.volumes.find(item => item.id === id)?.title || t('rest.sidebar.unvolumed')
const chapterListHint = (item) => {
  if (item.status === 'confirmed') return t('write.outline.confirmedWords', { words: numberText(item.word_count) })
  if (item.word_count) return t('write.outline.draftWords', { words: numberText(item.word_count) })
  return t('write.outline.noText')
}
const bookBlank = computed(() => {
  if (selected.value.type === 'world') return !bookText.value.trim() || bookText.value === DEFAULT_WORLD
  if (selected.value.type === 'outline') return !bookText.value.trim() || bookText.value === DEFAULT_OUTLINE
  return false
})
const volumeBlank = computed(() => selected.value.type === 'volume' && !String(volumeForm.goal || '').trim() && !String(volumeForm.outline || '').trim())
const chapterBlank = computed(() => {
  const item = chapter.value
  if (selected.value.type !== 'chapter' || !item) return false
  return ![item.goal, item.conflict, item.payoff, item.hook].some(value => String(value || '').trim())
})
const chatTarget = computed(() => {
  if (!store.book) return null
  if (selected.value.type === 'world' || selected.value.type === 'outline') {
    const world = selected.value.type === 'world'
    return {
      key: `book:${bookId.value}`,
      targetType: 'book',
      targetId: bookId.value,
      heading: world ? t('rest.chat.world') : t('write.outline.bookOutlineNote'),
      showFill: bookBlank.value,
      fillPrompt: world ? t('write.outline.fill.world') : t('write.outline.fill.book')
    }
  }
  if (selected.value.type === 'volume' && activeVolume.value) {
    return {
      key: `volume:${activeVolume.value.id}`,
      targetType: 'volume',
      targetId: activeVolume.value.id,
      heading: t('write.outline.volumeChat', { title: activeVolume.value.title }),
      showFill: volumeBlank.value,
      fillPrompt: t('write.outline.fill.volume')
    }
  }
  if (selected.value.type === 'chapter' && chapter.value) {
    return {
      key: `chapter:${chapter.value.id}`,
      targetType: 'chapter',
      targetId: chapter.value.id,
      heading: t('write.outline.chapterChat', { number: chapter.value.number }),
      showFill: chapterBlank.value,
      fillPrompt: t('write.outline.fill.chapter')
    }
  }
  return null
})

const askFill = async () => {
  chatOpen.value = true
  await nextTick()
  fillTick.value += 1
}

const onAiApplied = async () => {
  await reload()
  if (selected.value.type === 'world' || selected.value.type === 'outline') {
    bookText.value = store.book?.[selected.value.type] || ''
    bookSaveStatus.value = 'saved'
  } else if (selected.value.type === 'volume' && activeVolume.value) {
    Object.assign(volumeForm, { title: activeVolume.value.title || '', goal: activeVolume.value.goal || '', outline: activeVolume.value.outline || '' })
    volumeSaveStatus.value = 'saved'
  } else if (selected.value.type === 'chapter') {
    await loadChapter(selected.value.id)
    chapterFormKey.value += 1
  }
}

const flushBookSave = async () => {
  if (!bookTimer) return
  clearTimeout(bookTimer)
  bookTimer = null
  await saveBookText()
}

const select = async (type, id = 0) => {
  await flushBookSave()
  selected.value = { type, id }
  if (type === 'world' || type === 'outline') {
    bookText.value = store.book?.[type] || ''
    bookSaveStatus.value = ''
  } else if (type === 'volume') {
    Object.assign(volumeForm, { title: activeVolume.value?.title || '', goal: activeVolume.value?.goal || '', outline: activeVolume.value?.outline || '' })
    volumeSaveStatus.value = ''
  } else if (type === 'chapter') {
    await loadChapter(id)
  }
}

const loadChapter = async (id) => {
  chapter.value = null
  chapterError.value = ''
  try {
    const json = await cjApi(`/chapters/${id}`)
    chapter.value = json.data
  } catch (err) {
    chapterError.value = err.message
  }
}

const saveBookText = async () => {
  const field = selected.value.type
  if (field !== 'world' && field !== 'outline') return
  bookSaveStatus.value = 'saving'
  try {
    await cjApi(`/books/${bookId.value}`, { method: 'PUT', body: { [field]: bookText.value } })
    if (store.book) store.book[field] = bookText.value
    bookSaveStatus.value = 'saved'
  } catch (err) {
    bookSaveStatus.value = 'failed'
    toastError(err)
  }
}

const scheduleBookSave = () => {
  bookSaveStatus.value = 'editing'
  clearTimeout(bookTimer)
  bookTimer = setTimeout(() => { bookTimer = null; saveBookText() }, 1000)
}

const saveVolume = async () => {
  if (!volumeForm.title.trim()) return ElMessage.warning(t('write.outline.volumeNameRequired'))
  volumeSaveStatus.value = 'saving'
  try {
    await cjApi(`/volumes/${selected.value.id}`, { method: 'PUT', body: { ...volumeForm } })
    volumeSaveStatus.value = 'saved'
    await reload()
  } catch (err) {
    volumeSaveStatus.value = 'failed'
    toastError(err)
  }
}

const addVolume = async () => {
  try {
    const json = await cjApi('/volumes', { method: 'POST', body: { book_id: bookId.value } })
    await reload()
    select('volume', json.data.id)
    if (isMobile.value) {
      mobileVolumeKey.value = `v${json.data.id}`
      mobilePane.value = 'edit'
    }
  } catch (err) {
    toastError(err)
  }
}

const removeVolume = async () => {
  try {
    await ElMessageBox.confirm(t('write.outline.deleteVolumeMessage', { title: activeVolume.value.title }), t('write.outline.deleteVolume'), { confirmButtonText: t('rest.stats.delete'), cancelButtonText: t('rest.stats.cancel'), type: 'warning' })
  } catch {
    return
  }
  try {
    await cjApi(`/volumes/${selected.value.id}`, { method: 'DELETE' })
    await reload()
    select('outline')
    mobilePane.value = 'root'
  } catch (err) {
    toastError(err)
  }
}

const addChapter = async () => {
  const volumeId = selected.value.type === 'volume' ? selected.value.id : (selected.value.type === 'chapter' ? chapter.value?.volume_id : null)
  try {
    const body = { book_id: bookId.value }
    if (volumeId) body.volume_id = volumeId
    const json = await cjApi('/chapters', { method: 'POST', body })
    await reload()
    select('chapter', json.data.id)
  } catch (err) {
    toastError(err)
  }
}

const moveChapter = async (volumeId) => {
  try {
    await cjApi(`/chapters/${chapter.value.id}`, { method: 'PUT', body: { volume_id: volumeId } })
    chapter.value.volume_id = volumeId
    await reload()
  } catch (err) {
    toastError(err)
  }
}

const removeChapter = async () => {
  try {
    await ElMessageBox.confirm(t('write.outline.deleteChapterMessage', { number: chapter.value.number, title: chapter.value.title }), t('write.outline.deleteChapterTitle'), { confirmButtonText: t('rest.stats.delete'), cancelButtonText: t('rest.stats.cancel'), type: 'warning' })
  } catch {
    return
  }
  try {
    await cjApi(`/chapters/${chapter.value.id}`, { method: 'DELETE' })
    await reload()
    select('outline')
    mobilePane.value = mobileVolumeKey.value ? 'volume' : 'root'
  } catch (err) {
    toastError(err)
  }
}

const onChapterSaved = async () => {
  await reload()
  const fresh = await cjApi(`/chapters/${selected.value.id}`).catch(() => null)
  if (fresh && chapter.value?.id === fresh.data.id) {
    chapter.value.title = fresh.data.title
    chapter.value.target_words = fresh.data.target_words
  }
}

const openVolumeList = (group) => {
  mobileVolumeKey.value = group.key
  mobilePane.value = 'volume'
}

const editBookField = async (type) => {
  await select(type)
  mobilePane.value = 'edit'
}

const editVolume = async () => {
  if (!mobileGroup.value?.volume) return
  await select('volume', mobileGroup.value.volume.id)
  mobilePane.value = 'edit'
}

const editChapter = async (id) => {
  await select('chapter', id)
  mobilePane.value = 'edit'
}

const addChapterMobile = async () => {
  const group = mobileGroup.value
  if (group?.volume) selected.value = { type: 'volume', id: group.volume.id }
  else selected.value = { type: 'outline', id: 0 }
  await addChapter()
  mobilePane.value = 'edit'
}

const mobileUp = async () => {
  await flushBookSave()
  if (mobilePane.value === 'edit' && (selected.value.type === 'chapter' || selected.value.type === 'volume') && mobileVolumeKey.value) {
    mobilePane.value = 'volume'
    return
  }
  mobilePane.value = 'root'
}

watch([isMobile, mobilePane], () => {
  if (!mobileBack) return
  if (!isMobile.value || mobilePane.value === 'root') {
    if (mobileBack.value === mobileUp) mobileBack.value = null
    return
  }
  mobileBack.value = mobileUp
}, { immediate: true })

const revealMobile = (type, id) => {
  if (!isMobile.value) return
  if (type === 'volume' || type === 'chapter') {
    const chapterRow = type === 'chapter' ? store.chapters.find(item => item.id === id) : null
    const volumeId = type === 'volume' ? id : chapterRow?.volume_id
    const group = groups.value.find(item => item.volume?.id === volumeId) || groups.value.find(item => item.key === 'loose')
    if (group) mobileVolumeKey.value = group.key
  }
  mobilePane.value = 'edit'
}

// 书的数据加载后再填充总纲。从搜索进来时打开对应的世界观、总纲、卷或章节。
watch(() => [store.book?.id, route.query.type, route.query.id], () => {
  if (!store.book?.id) return
  const type = String(route.query.type || '')
  const target = Number(route.query.id) || 0
  if (type === 'world' || type === 'outline') {
    select(type)
    revealMobile(type, 0)
    return
  }
  if ((type === 'volume' || type === 'chapter') && target) {
    select(type, target)
    revealMobile(type, target)
    return
  }
  if (selected.value.type === 'outline' || selected.value.type === 'world') select(selected.value.type)
}, { immediate: true })

onBeforeUnmount(() => {
  flushBookSave()
  if (mobileBack?.value === mobileUp) mobileBack.value = null
})
</script>

<style scoped>
.cj-main { flex: 1; display: flex; min-height: 0; }
.tree { width: 236px; background: var(--cj-paper); border-right: 1px solid var(--cj-line); padding: 14px 10px; overflow-y: auto; flex-shrink: 0; }
.tree-head { display: flex; align-items: center; margin-bottom: 10px; padding: 0 4px; }
.node { padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
.node:hover { background: #f7f3ed; }
.node.on { background: var(--cj-gray-soft); font-weight: 600; }
.node.child { padding-left: 22px; }
.save-state { font-size: 12px; }
.md-editor :deep(textarea) { font-family: var(--cj-serif); line-height: 1.9; font-size: 15px; padding: 14px 16px; }
.volume-form { max-width: 760px; display: flex; flex-direction: column; gap: 14px; }
.field > label { display: block; font-size: 12px; color: var(--cj-sub); margin-bottom: 6px; font-weight: 600; }
.chapter-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; align-items: start; }
.side { display: flex; flex-direction: column; gap: 14px; }
.side-card { padding: 14px 16px; }
@media (max-width: 960px) {
  .chapter-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .cj-main { flex-direction: column; overflow-y: auto; }
  .tree { width: 100%; max-height: 240px; border-right: none; border-bottom: 1px solid var(--cj-line); }
}
.cj-main.is-mobile { flex-direction: column; overflow: hidden; }
.cj-main.is-mobile > .cj-page { padding: 12px 14px 20px; }
.cj-main.is-mobile .chapter-grid { grid-template-columns: 1fr; }
.m-outline { flex: 1; min-height: 0; overflow: auto; padding: 12px; }
.m-block { background: var(--cj-paper); border: 1px solid var(--cj-line); border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.m-row {
  width: 100%;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid var(--cj-line);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
.m-block .m-row:last-child { border-bottom: 0; }
.m-row small { color: var(--cj-sub); font-size: 12px; }
.m-subhead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; font-size: 18px; }
</style>
