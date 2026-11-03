<template>
  <div class="cj-main" :class="{ 'is-mobile': isMobile, 'tools-open': toolsOpen }">
    <ChapterSidebar v-show="!isMobile" :chapters="store.chapters" :volumes="store.volumes" :active-id="chapterId" :creating="creating"
      @select="openChapter" @create="createChapter" />
    <el-drawer v-if="isMobile" v-model="chapterDrawer" direction="ltr" size="86%" :with-header="false" append-to-body class="cj-chapter-drawer">
      <ChapterSidebar :chapters="store.chapters" :volumes="store.volumes" :active-id="chapterId" :creating="creating"
        @select="onMobileSelect" @create="onMobileCreate" />
    </el-drawer>

    <div v-if="!chapterId" class="center">
      <i18n-t :keypath="isMobile ? 'write.writing.emptyNoChaptersMobile' : 'write.writing.emptyNoChaptersDesktop'" tag="div" class="cj-empty">
        <template #page>
          <router-link :to="`/changjuan/book/${bookId}/outline`">{{ $t('write.writing.outlinePage') }}</router-link>
        </template>
      </i18n-t>
      <div v-if="isMobile" class="m-bar">
        <button type="button" class="cj-btn" @click="chapterDrawer = true">{{ $t('rest.sidebar.title') }}</button>
      </div>
    </div>
    <div v-else-if="loading && !chapter" class="center"><div class="cj-empty">{{ $t('rest.read.loading') }}</div></div>
    <div v-else-if="loadError" class="center"><div class="cj-page"><div class="cj-error-box">{{ loadError }}</div></div></div>

    <template v-else-if="chapter">
      <ConfirmChanges v-if="mode === 'confirm' && chapter.status !== 'confirmed'" :chapter="chapter"
        @back="setMode('')" @refresh="loadChapter" @confirmed="onConfirmed" @locate="locateFromConfirm"
        @settings="router.push(`/changjuan/book/${bookId}/settings`)">
        <template #steps><StepBar :steps="steps" /></template>
      </ConfirmChanges>

      <ChapterDone v-else-if="chapter.status === 'confirmed' && !reading" :chapter="chapter" :book-id="bookId"
        @next="goNextChapter" @read="reading = true" @refresh="refreshAll">
        <template #steps><StepBar :steps="steps" /></template>
      </ChapterDone>

      <template v-else>
        <section class="center">
          <div class="center-head">
            <div class="title-block">
              <div class="cj-muted" style="font-size: 12px">{{ $t('rest.context.chapter', { number: chapter.number }) }}</div>
              <div class="cj-serif chapter-title">{{ chapter.title }}</div>
            </div>
            <StepBar v-if="!isMobile" :steps="steps" />
            <div v-if="!isMobile" class="cj-spacer"></div>
            <template v-if="!isMobile && generating">
              <span class="cj-muted">{{ $t('write.writing.wordProgress', { current: numberText(liveWords), target: numberText(targetWords) }) }}</span>
              <button class="cj-btn" @click="stopGenerate">{{ $t('write.writing.stopGenerate') }}</button>
            </template>
            <template v-else-if="!isMobile && chapter.status === 'confirmed'">
              <span class="cj-muted">{{ $t('write.writing.confirmedReadonly', { words: numberText(chapter.word_count) }) }}</span>
              <button class="cj-btn" @click="reading = false">{{ $t('shell.layout.back') }}</button>
            </template>
            <template v-else-if="!isMobile">
              <span class="cj-muted">{{ $t('rest.read.words', { count: numberText(wordCount) }) }}</span>
              <span v-if="saveState" class="cj-muted save-state">{{ saveState }}</span>
              <button v-if="hasContent" class="cj-btn sm ghost" @click="toggleEdit">{{ editing ? $t('write.writing.doneEditing') : $t('write.writing.editProse') }}</button>
              <button v-if="hasContent && wordCount < targetWords" class="cj-btn" :disabled="busy" @click="startGenerate('continue')">{{ $t('write.writing.continue') }}</button>
              <button class="cj-btn" :class="{ pri: !hasContent }" :disabled="busy" @click="startGenerate('full')">{{ hasContent ? $t('write.writing.regenerate') : $t('shell.settings.taskNames.generate') }}</button>
              <button v-if="hasContent" class="cj-btn pri" :disabled="busy" @click="runCheck()">{{ checking ? $t('write.writing.checking') : (chapter.check_run ? $t('write.writing.checkAgain') : $t('shell.settings.taskNames.check')) }}</button>
            </template>
          </div>

          <div v-if="genError" class="gen-error" :class="genError.kind">
            <b>{{ genError.title }}</b>
            <div>{{ genError.detail }}</div>
            <div class="gen-error-actions">
              <button v-if="genError.saved" class="cj-btn sm" @click="startGenerate('continue')">{{ $t('write.writing.continue') }}</button>
              <button v-if="genError.saved" class="cj-btn sm" @click="startGenerate('full')">{{ $t('write.writing.startOver') }}</button>
              <button v-if="genError.settings" class="cj-btn sm" @click="router.push(`/changjuan/book/${bookId}/settings`)">{{ genError.settings }}</button>
              <button class="cj-btn sm ghost" @click="genError = null">{{ $t('rest.stats.close') }}</button>
            </div>
          </div>

          <div ref="bodyRef" class="center-body">
            <div v-if="generating" class="paper cj-serif">
              <div v-if="liveReasoning" class="thinking" :class="{ done: liveParagraphs.length }">
                <div class="thinking-head">{{ liveParagraphs.length ? $t('write.writing.thinkingDone') : $t('write.writing.thinking', { words: numberText(liveReasoning.length) }) }}</div>
                <div v-if="!liveParagraphs.length" class="thinking-body">{{ liveReasoning.slice(-600) }}</div>
              </div>
              <div v-else-if="!liveParagraphs.length" class="cj-muted thinking-head">{{ liveContext ? $t('write.writing.waiting') : $t('write.writing.preparing') }}</div>
              <p v-for="(text, index) in liveParagraphs" :key="index">{{ text }}</p>
              <p class="cj-muted cursor">▍</p>
            </div>
            <div v-else-if="!hasContent && !editing" class="cj-empty">
              {{ $t('write.writing.emptyProse') }}<br>
              <i18n-t :keypath="isMobile ? 'write.writing.emptyProseHintMobile' : 'write.writing.emptyProseHintDesktop'" tag="span">
                <template #write>
                  <a class="link" @click="toggleEdit">{{ $t('write.writing.writeItYourself') }}</a>
                </template>
              </i18n-t>
            </div>
            <el-input v-else-if="editing" v-model="draft" type="textarea" class="paper-editor cj-serif" resize="none"
              :autosize="isMobile ? false : { minRows: 18 }" :placeholder="$t('write.writing.paragraphPlaceholder')" @input="scheduleSave" @blur="saveNow" />
            <div v-else class="paper cj-serif" @dblclick="chapter.status !== 'confirmed' && toggleEdit()">
              <p v-for="(text, index) in paragraphs" :key="index" :ref="el => setParagraphRef(index + 1, el)"
                :class="paragraphClass(index + 1)">
                {{ text }}<sup v-for="issue in paragraphIssues(index + 1)" :key="issue.id" :class="issue.severity">[{{ issue.seq }}]</sup>
              </p>
            </div>
          </div>

          <div v-if="isMobile" class="m-bar">
            <button type="button" class="cj-btn" @click="chapterDrawer = true">{{ $t('rest.sidebar.title') }}</button>
            <div class="m-status">
              <template v-if="generating">{{ liveStatus }} · {{ $t('rest.read.words', { count: numberText(liveWords) }) }}</template>
              <template v-else-if="chapter.status === 'confirmed'">{{ $t('write.writing.readonlyWords', { words: numberText(chapter.word_count) }) }}</template>
              <template v-else>{{ numberText(wordCount) }} / {{ numberText(targetWords) }}<template v-if="saveState"> · {{ saveState }}</template></template>
            </div>
            <button v-if="generating" type="button" class="cj-btn pri stop-btn" @click="stopGenerate">{{ $t('rest.chat.stop') }}</button>
            <button v-else-if="chapter.status === 'confirmed'" type="button" class="cj-btn" @click="reading = false">{{ $t('shell.layout.back') }}</button>
            <template v-else>
              <button v-if="hasContent && wordCount < targetWords" type="button" class="cj-btn" :disabled="busy" @click="startGenerate('continue')">{{ $t('write.writing.continueShort') }}</button>
              <button type="button" class="cj-btn" :class="{ pri: !hasContent }" :disabled="busy" @click="startGenerate('full')">{{ hasContent ? $t('write.writing.regenerateShort') : $t('write.writing.generateShort') }}</button>
              <button type="button" class="cj-btn" @click="toolsOpen = !toolsOpen">{{ $t('write.writing.tools') }}</button>
            </template>
          </div>

          <div v-if="!isMobile" class="center-foot cj-muted">
            <span v-if="chapter.goal">{{ $t('write.writing.goalLine', { text: chapter.goal }) }}</span>
            <span v-if="chapter.hook">{{ $t('write.writing.hookLine', { text: chapter.hook }) }}</span>
            <div class="cj-spacer"></div>
            <span>{{ $t('write.writing.targetLine', { words: numberText(targetWords) }) }}</span>
          </div>
        </section>

        <button v-if="isMobile && toolsOpen" type="button" class="sheet-mask" :aria-label="$t('write.writing.closeTools')" @click="toolsOpen = false"></button>
        <aside v-show="!isMobile || toolsOpen" class="right">
          <div v-if="isMobile" class="sheet-head">
            <b>{{ $t('write.writing.chapterTools') }}</b>
            <div class="cj-spacer"></div>
            <button type="button" class="cj-btn" @click="toggleEdit">{{ editing ? $t('write.writing.doneEditing') : $t('write.writing.editProse') }}</button>
            <button v-if="hasContent" type="button" class="cj-btn" :disabled="busy" @click="runCheck()">{{ checking ? $t('write.writing.checking') : $t('write.writing.checkShort') }}</button>
            <button type="button" class="cj-btn" @click="toolsOpen = false">{{ $t('rest.stats.close') }}</button>
          </div>
          <div class="tabs">
            <div v-for="tab in tabs" :key="tab.key" class="tab" :class="{ on: activeTab === tab.key }" @click="activeTab = tab.key">
              {{ tab.label }} <span v-if="tab.badge" class="cj-tag" :class="tab.badgeColor">{{ tab.badge }}</span>
            </div>
          </div>
          <div class="right-body">
            <IssuePanel v-if="activeTab === 'check'" :chapter="chapter" @locate="locateIssue" @open-card="openCard" @changed="refreshAll" />
            <ContextPanel v-else-if="activeTab === 'context'" :chapter="chapter" :version="contextVersion" :live="generating ? liveContext : null"
              @add-character="addCharacter" @create-card="createCard" />
            <template v-else>
              <div class="outline-tools">
                <button v-if="chapterBlank" type="button" class="cj-btn sm" @click="askFill">{{ $t('rest.chat.fill') }}</button>
                <button type="button" class="cj-btn sm" @click="openChat">{{ $t('rest.chat.heading') }}</button>
              </div>
              <OutlineForm ref="outlineRef" :chapter="chapter" :book-id="bookId" :default-words="store.book?.chapter_words || 2500" compact @saved="onOutlineSaved" />
            </template>
          </div>
          <div v-if="chapter.status !== 'confirmed'" class="right-foot">
            <button class="cj-btn pri block" :disabled="!chapter.can_extract || busy || dirtyLocal" @click="setMode('confirm')">{{ $t('rest.confirm.title') }}</button>
            <div class="cj-muted hint">{{ confirmHint }}</div>
          </div>
        </aside>
      </template>
      <div v-if="isMobile && mobileChapterOnly" class="m-bar">
        <button type="button" class="cj-btn" @click="chapterDrawer = true">{{ $t('rest.sidebar.title') }}</button>
        <div class="m-status">{{ $t('rest.chapter.head', { number: chapter.number, title: chapter.title }) }}</div>
      </div>
    </template>
    <AiChatPanel
      v-if="chatOpen && chapter"
      :key="`chapter:${chapter.id}`"
      :book-id="bookId"
      target-type="chapter"
      :target-id="chapter.id"
      :heading="$t('write.outline.chapterChat', { number: chapter.number })"
      :show-fill="chapterBlank"
      :fill-prompt="$t('write.outline.fill.chapter')"
      :fill-tick="fillTick"
      @close="chatOpen = false"
      @applied="onAiApplied"
    />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { cjApi, cjStream, numberText, promptModelSetup, settingsButtonLabel, toastError } from './api.js'
import ChapterSidebar from './components/ChapterSidebar.vue'
import IssuePanel from './components/IssuePanel.vue'
import ContextPanel from './components/ContextPanel.vue'
import OutlineForm from './components/OutlineForm.vue'
import AiChatPanel from './components/AiChatPanel.vue'
import ConfirmChanges from './components/ConfirmChanges.vue'
import ChapterDone from './components/ChapterDone.vue'
import StepBar from './components/StepBar.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isMobile } = useIsMobile()
const { store, reload: reloadBook, bookId } = inject('cj')
const chapterDrawer = ref(false)
const toolsOpen = ref(false)

const chapterId = computed(() => Number(route.params.chapterId) || 0)
const mode = computed(() => route.query.mode || '')
const chapter = ref(null)
const loading = ref(false)
const loadError = ref('')
const creating = ref(false)
const reading = ref(false)
const editing = ref(false)
const draft = ref('')
const saveStatus = ref('')
const dirtyLocal = ref(false)
const checking = ref(false)
const generating = ref(false)
const liveText = ref('')
const liveContext = ref(null)
const liveReasoning = ref('')
const genError = ref(null)
const activeTab = ref('check')
const contextVersion = ref(0)
const bodyRef = ref(null)
const outlineRef = ref(null)
const chatOpen = ref(false)
const fillTick = ref(0)
const paragraphRefs = {}
let saveTimer = null
let abortController = null

const busy = computed(() => generating.value || checking.value)
const mobileChapterOnly = computed(() => {
  if (!chapter.value) return false
  if (mode.value === 'confirm' && chapter.value.status !== 'confirmed') return true
  return chapter.value.status === 'confirmed' && !reading.value
})
const hasContent = computed(() => !!(editing.value ? draft.value : chapter.value?.content || '').trim())
const paragraphs = computed(() => String(chapter.value?.content || '').split('\n').map(line => line.trim()).filter(Boolean))
const liveParagraphs = computed(() => liveText.value.split('\n').map(line => line.trim()).filter(Boolean))
const liveStatus = computed(() => {
  if (liveParagraphs.value.length) return t('write.writing.writingNow')
  if (liveReasoning.value) return t('write.writing.thinkingShort')
  if (liveContext.value) return t('write.writing.waitingShort')
  return t('write.writing.preparingShort')
})
const liveWords = computed(() => liveText.value.replace(/\s+/g, '').length)
const saveState = computed(() => {
  if (saveStatus.value === 'saving') return t('rest.outlineForm.saving')
  if (saveStatus.value === 'saved') return t('rest.outlineForm.saved')
  if (saveStatus.value === 'failed') return t('write.common.saveFailed')
  if (saveStatus.value === 'unsaved') return t('shell.settings.statusUnsaved')
  return ''
})
const wordCount = computed(() => (editing.value ? draft.value : chapter.value?.content || '').replace(/\s+/g, '').length)
const targetWords = computed(() => chapter.value?.target_words || store.book?.chapter_words || 2500)
const openIssues = computed(() => (chapter.value?.issues || []).filter(item => !item.false_positive))

const steps = computed(() => {
  const c = chapter.value
  if (!c) return []
  const content = !!String(c.content || '').trim()
  const done = [
    !!(c.goal || c.title),
    content,
    content && (c.check_run > 0 || c.content !== c.generated_content),
    !!c.can_extract || c.status === 'confirmed',
    c.status === 'confirmed'
  ]
  const current = mode.value === 'confirm' && c.status !== 'confirmed' ? 4 : done.findIndex(value => !value)
  return ['outline', 'generate', 'revise', 'check', 'confirm'].map((key, index) => ({
    label: t(`write.writing.steps.${key}`),
    state: index === current ? 'cur' : (done[index] && (current === -1 || index < current) ? 'done' : '')
  }))
})

const tabs = computed(() => [
  { key: 'check', label: t('shell.settings.taskNames.check'), badge: openIssues.value.length || '', badgeColor: openIssues.value.some(item => item.severity === 'must') ? 'red' : 'amb' },
  { key: 'context', label: t('write.writing.tabContext') },
  { key: 'outline', label: t('write.writing.steps.outline') }
])

const confirmHint = computed(() => {
  const c = chapter.value
  if (!c || !String(c.content || '').trim()) return t('write.writing.confirmNeedText')
  if (!c.check_run) return t('write.writing.confirmNeedCheck')
  if (c.check_dirty || dirtyLocal.value) return t('write.writing.confirmDirty')
  if (c.must_open) return t('write.writing.confirmMust', { count: c.must_open })
  return t('write.writing.confirmReady')
})

const loadChapter = async () => {
  if (!chapterId.value) return
  loading.value = true
  loadError.value = ''
  try {
    const json = await cjApi(`/chapters/${chapterId.value}`)
    chapter.value = json.data
    if (!dirtyLocal.value) draft.value = json.data.content
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([loadChapter(), reloadBook()])
}

// 正文编辑与自动保存。必须写在章节监听前面：immediate 监听会在 setup 里立刻调用 flushSave
const saveNow = async () => {
  clearTimeout(saveTimer)
  if (!dirtyLocal.value || !chapter.value) return
  const content = draft.value
  saveStatus.value = 'saving'
  try {
    await cjApi(`/chapters/${chapter.value.id}`, { method: 'PUT', body: { content } })
    if (draft.value === content) dirtyLocal.value = false
    chapter.value.content = content
    chapter.value.check_dirty = 1
    chapter.value.can_extract = false
    saveStatus.value = 'saved'
  } catch (err) {
    saveStatus.value = 'failed'
    toastError(err)
  }
}
const flushSave = () => saveNow()
const scheduleSave = () => {
  dirtyLocal.value = true
  saveStatus.value = 'unsaved'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 1200)
}

// 没指定章节时，打开第一个未确认的章节
const ensureChapter = () => {
  if (chapterId.value || !store.chapters.length) return
  const target = store.chapters.find(item => item.status !== 'confirmed') || store.chapters[store.chapters.length - 1]
  router.replace(`/changjuan/book/${bookId.value}/write/${target.id}`)
}

const showParagraph = async (paragraph) => {
  if (!paragraph || !chapter.value) return
  editing.value = false
  if (chapter.value.status === 'confirmed') reading.value = true
  await nextTick()
  scrollToParagraph(paragraph)
}

watch(chapterId, async () => {
  await flushSave()
  chapter.value = null
  const paragraph = Number(route.query.p) || 0
  reading.value = paragraph > 0
  genError.value = null
  dirtyLocal.value = false
  saveStatus.value = ''
  await loadChapter()
  const content = String(chapter.value?.content || '')
  editing.value = !!chapter.value && chapter.value.status !== 'confirmed' && !chapter.value.check_run && !!content.trim()
  activeTab.value = content.trim() ? 'check' : 'context'
  await showParagraph(paragraph)
}, { immediate: true })
watch(() => route.query.p, (value) => {
  if (!chapter.value || chapter.value.id !== chapterId.value) return
  showParagraph(Number(value) || 0)
})
watch(() => store.chapters, ensureChapter, { immediate: true })

const openChapter = (id) => router.push(`/changjuan/book/${bookId.value}/write/${id}`)
const onMobileSelect = (id) => {
  chapterDrawer.value = false
  openChapter(id)
}
const onMobileCreate = () => {
  chapterDrawer.value = false
  createChapter()
}
watch(isMobile, (value) => {
  if (!value) {
    chapterDrawer.value = false
    toolsOpen.value = false
  }
})
const setMode = (value) => router.replace({ query: value ? { mode: value } : {} })

const createChapter = async () => {
  creating.value = true
  try {
    const json = await cjApi('/chapters', { method: 'POST', body: { book_id: bookId.value } })
    await reloadBook()
    openChapter(json.data.id)
    activeTab.value = 'outline'
  } catch (err) {
    toastError(err)
  } finally {
    creating.value = false
  }
}

const toggleEdit = async () => {
  if (editing.value) {
    await saveNow()
    await loadChapter()
    editing.value = false
  } else {
    draft.value = chapter.value.content
    editing.value = true
  }
}

// ===== 定位原文 =====
const setParagraphRef = (index, el) => { if (el) paragraphRefs[index] = el }
const paragraphIssues = (index) => openIssues.value.filter(item => item.paragraph === index)
const flashParagraph = ref(0)
const paragraphClass = (index) => {
  const issues = paragraphIssues(index)
  const severity = ['must', 'should', 'hint'].find(key => issues.some(item => item.severity === key))
  return [severity ? `hl-${severity}` : '', flashParagraph.value === index ? 'flash' : '']
}
const scrollToParagraph = async (index) => {
  if (editing.value) await toggleEdit()
  await nextTick()
  paragraphRefs[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashParagraph.value = index
  setTimeout(() => { if (flashParagraph.value === index) flashParagraph.value = 0 }, 1600)
}
const locateIssue = (issue) => issue.paragraph && scrollToParagraph(issue.paragraph)
const locateFromConfirm = (paragraph) => {
  setMode('')
  setTimeout(() => scrollToParagraph(paragraph), 50)
}

// ===== 生成正文 =====
const startGenerate = async (generateMode, force = false) => {
  if (generateMode === 'full' && chapter.value.content.trim() && !force) {
    try {
      await ElMessageBox.confirm(t('write.writing.regenMessage'), t('write.writing.regenerate'), { confirmButtonText: t('write.writing.regenerate'), cancelButtonText: t('rest.stats.cancel'), type: 'warning' })
    } catch {
      return
    }
  }
  await saveNow()
  editing.value = false
  toolsOpen.value = false
  chapterDrawer.value = false
  genError.value = null
  liveText.value = generateMode === 'continue' ? `${chapter.value.content}\n` : ''
  liveContext.value = null
  liveReasoning.value = ''
  generating.value = true
  activeTab.value = 'context'
  abortController = new AbortController()
  let finished = false
  try {
    await cjStream(`/chapters/${chapter.value.id}/generate`, { mode: generateMode, force }, (event) => {
      if (event.type === 'context') liveContext.value = event.data
      else if (event.type === 'reasoning') liveReasoning.value += event.text
      else if (event.type === 'delta') {
        liveText.value += event.text
        const el = bodyRef.value
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight
      } else if (event.type === 'done') {
        finished = true
        ElMessage.success(event.aborted ? t('write.writing.stoppedSaved') : t('write.writing.generated', { words: numberText(event.words) }))
      } else if (event.type === 'error') {
        finished = true
        genError.value = {
          kind: 'error',
          title: t('write.writing.generateFailed', { message: event.message }),
          detail: event.detail,
          saved: event.saved,
          settings: settingsButtonLabel(event.error_type)
        }
      }
    }, abortController.signal)
    if (!finished && !abortController.signal.aborted) {
      genError.value = { kind: 'error', title: t('write.writing.networkTitle'), detail: t('write.writing.networkDetail'), saved: true }
    }
  } catch (err) {
    const type = err.data?.error_type
    const settings = type === 'not_configured' || type === 'local_key_missing' ? settingsButtonLabel(type) : ''
    genError.value = { kind: 'error', title: t('write.writing.generateFailed', { message: err.message }), detail: t('write.writing.nothingWritten', { number: chapter.value.number }), settings }
  } finally {
    generating.value = false
    abortController = null
    await refreshAll()
    contextVersion.value++
  }
}

const stopGenerate = () => abortController?.abort()

// ===== 一致性检查 =====
const runCheck = async () => {
  await saveNow()
  checking.value = true
  try {
    const json = await cjApi(`/chapters/${chapter.value.id}/check`, { method: 'POST', body: {} })
    chapter.value = json.data
    editing.value = false
    activeTab.value = 'check'
    const count = json.data.issues.filter(item => !item.false_positive).length
    ElMessage.success(count ? t('write.writing.checkFound', { count }) : t('write.writing.checkClean'))
    reloadBook()
  } catch (err) {
    if (await promptModelSetup(err, () => router.push(`/changjuan/book/${bookId.value}/settings`))) return
    toastError(err)
  } finally {
    checking.value = false
  }
}

// ===== 其他交互 =====
const chapterBlank = computed(() => {
  const item = chapter.value
  if (!item) return false
  return ![item.goal, item.conflict, item.payoff, item.hook].some(value => String(value || '').trim())
})

const openChat = () => {
  activeTab.value = 'outline'
  if (isMobile.value) toolsOpen.value = true
  chatOpen.value = true
}

const askFill = async () => {
  openChat()
  await nextTick()
  fillTick.value += 1
}

const onAiApplied = async () => {
  await refreshAll()
  outlineRef.value?.reload?.()
}

const onOutlineSaved = () => {
  contextVersion.value++
  loadChapter()
  reloadBook()
}
const addCharacter = async (name) => {
  const names = [...new Set([...(chapter.value.characters || []), name])]
  try {
    await cjApi(`/chapters/${chapter.value.id}`, { method: 'PUT', body: { characters: names } })
    ElMessage.success(t('write.writing.addedCast', { name }))
    onOutlineSaved()
  } catch (err) {
    toastError(err)
  }
}
const createCard = async (name) => {
  try {
    await cjApi('/cards', { method: 'POST', body: { book_id: bookId.value, kind: 'character', name } })
    ElMessage.success(t('rest.outlineForm.created', { name }))
    contextVersion.value++
  } catch (err) {
    toastError(err)
  }
}
const openCard = (name) => router.push({ path: `/changjuan/book/${bookId.value}/memory`, query: { card: name } })

const onConfirmed = async () => {
  setMode('')
  reading.value = false
  await refreshAll()
}

const goNextChapter = async () => {
  const next = store.chapters.find(item => item.number === chapter.value.number + 1)
  if (next) return openChapter(next.id)
  try {
    const json = await cjApi('/chapters', { method: 'POST', body: { book_id: bookId.value, number: chapter.value.number + 1, volume_id: chapter.value.volume_id } })
    await reloadBook()
    openChapter(json.data.id)
    activeTab.value = 'outline'
  } catch (err) {
    toastError(err)
  }
}

onBeforeRouteLeave(() => flushSave())
onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  abortController?.abort()
})
</script>

<style scoped>
.cj-main { flex: 1; display: flex; min-height: 0; }
.center { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.center-head { padding: 14px 28px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--cj-line); background: var(--cj-paper); flex-wrap: wrap; }
.chapter-title { font-size: 20px; font-weight: 700; }
.save-state { font-size: 12px; }
.center-body { flex: 1; overflow-y: auto; padding: 30px 24px; display: flex; justify-content: center; min-height: 0; }
.paper { width: 640px; max-width: 100%; font-size: 17px; line-height: 2.1; color: #2a2620; display: flex; flex-direction: column; gap: 14px; }
.paper p { margin: 0; padding: 2px 8px; margin-left: -11px; border-left: 3px solid transparent; border-radius: 2px; transition: background .3s; }
.paper p.hl-must { background: var(--cj-red-soft); border-left-color: var(--cj-red); }
.paper p.hl-should { background: var(--cj-amber-soft); border-left-color: var(--cj-amber); }
.paper p.hl-hint { background: var(--cj-gray-soft); border-left-color: var(--cj-sub); }
.paper p.flash { box-shadow: 0 0 0 2px var(--cj-accent); }
.paper sup { font-family: sans-serif; font-size: 10px; margin-left: 3px; color: var(--cj-sub); }
.paper sup.must { color: var(--cj-red); }
.paper sup.should { color: var(--cj-amber); }
.cursor { animation: blink 1s steps(1) infinite; }
.thinking { border-left: 3px solid #d8cfbf; padding: 4px 0 4px 12px; font-family: system-ui, sans-serif; }
.thinking-head { font-size: 13px; color: #8a8070; }
.thinking-body { margin-top: 6px; font-size: 13px; line-height: 1.7; color: #9a917f; white-space: pre-wrap; max-height: 220px; overflow: hidden; }
@keyframes blink { 50% { opacity: 0; } }
.paper-editor { width: 680px; max-width: 100%; }
.paper-editor :deep(.el-textarea__inner) { font-family: var(--cj-serif); font-size: 17px; line-height: 2.1; color: #2a2620; background: transparent; box-shadow: none; padding: 0 8px; }
.paper-editor :deep(.el-textarea__inner:focus) { box-shadow: none; }
.center-foot { padding: 8px 28px; border-top: 1px solid var(--cj-line); background: var(--cj-paper); display: flex; gap: 18px; font-size: 12px; }
.center-foot span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gen-error { margin: 12px 28px 0; border-radius: 8px; padding: 12px 14px; line-height: 1.7; background: var(--cj-red-soft); border: 1px solid #f0c4bd; color: var(--cj-red); }

.gen-error div { color: var(--cj-ink); }
.gen-error-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.link { color: var(--cj-accent); cursor: pointer; }
.right { width: 380px; background: var(--cj-paper); border-left: 1px solid var(--cj-line); display: flex; flex-direction: column; flex-shrink: 0; min-height: 0; }
.tabs { display: flex; border-bottom: 1px solid var(--cj-line); }
.outline-tools { display: flex; justify-content: flex-end; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--cj-line); }
.tab { flex: 1; text-align: center; padding: 12px 4px; color: var(--cj-sub); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.tab.on { border-bottom-color: var(--cj-accent); color: var(--cj-accent); font-weight: 600; }
.right-body { flex: 1; overflow-y: auto; padding: 14px 16px; min-height: 0; }
.right-foot { padding: 14px 16px; border-top: 1px solid var(--cj-line); }
.right-foot .hint { font-size: 11px; text-align: center; margin-top: 6px; }
@media (max-width: 1100px) {
  .right { width: 320px; }
}
@media (max-width: 768px) {
  .cj-main { flex-direction: column; overflow-y: auto; }
  .center { min-height: 70vh; }
  .center-head, .center-foot { padding-left: 16px; padding-right: 16px; }
  .right { width: 100%; border-left: none; border-top: 1px solid var(--cj-line); }
}
.cj-main.is-mobile { flex-direction: column; overflow: hidden; position: relative; }
.cj-main.is-mobile .center { min-height: 0; flex: 1; }
.cj-main.is-mobile .center > .cj-empty { flex: 1; }
.cj-main.is-mobile .center-head { padding: 8px 16px; }
.cj-main.is-mobile .center-body { padding: 16px 16px 12px; flex-direction: column; align-items: stretch; justify-content: flex-start; }
.cj-main.is-mobile .paper { width: 100%; font-size: 18px; line-height: 1.9; }
.cj-main.is-mobile .paper-editor { width: 100%; flex: 1; min-height: 0; height: auto; display: flex; }
.cj-main.is-mobile .paper-editor :deep(.el-textarea__inner) {
  flex: 1;
  height: auto !important;
  min-height: 0;
  font-size: 18px !important;
  line-height: 1.9;
}
.cj-main.is-mobile .gen-error { margin: 8px 12px 0; }
.m-bar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--cj-paper);
  border-top: 1px solid var(--cj-line);
  flex-shrink: 0;
}
.m-bar .cj-btn { padding-left: 10px; padding-right: 10px; flex: 0 0 auto; }
.m-status { flex: 1 1 auto; min-width: 0; color: var(--cj-sub); font-size: 12px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stop-btn { flex: 1; }
.sheet-mask { position: absolute; inset: 0; border: 0; background: rgba(35, 32, 28, 0.35); z-index: 4; padding: 0; }
.cj-main.is-mobile .right {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  height: min(78%, 640px);
  z-index: 5;
  border-left: none;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -8px 30px rgba(35, 32, 28, 0.16);
}
.sheet-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--cj-line); flex-wrap: wrap; }
.cj-main.is-mobile .tab { min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 4px; }
</style>
