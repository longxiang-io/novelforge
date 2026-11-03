<template>
  <Teleport to="body" :disabled="!isMobile">
  <aside class="ai-panel" :class="{ 'is-mobile': isMobile }">
    <div class="ai-head">
      <div class="ai-head-row">
        <b>{{ headingText }}</b>
        <button type="button" class="cj-btn sm ghost" @click="$emit('close')">{{ $t('rest.chat.hide') }}</button>
      </div>
      <div v-if="phrase" class="cj-muted ai-phrase">{{ phrase }}</div>
    </div>
    <p v-if="model.fallback" class="ai-banner">
      {{ $t('rest.chat.fallback') }}
      <router-link :to="settingsTo">{{ $t('rest.chat.settings') }}</router-link>
    </p>
    <p v-else-if="model.loaded && !model.ready" class="ai-banner">
      {{ $t('rest.chat.noModel') }}
      <router-link :to="settingsTo">{{ $t('rest.chat.settings') }}</router-link>
    </p>
    <div ref="log" class="ai-log">
      <div v-if="!messages.length && !sending" class="cj-muted ai-empty">{{ $t('rest.chat.empty') }}</div>
      <div v-for="message in messages" :key="message.id" class="bubble" :class="message.role">
        <div class="bubble-text">{{ message.content }}</div>
        <div v-if="pendingCount(message)" class="suggest-actions">
          <button class="cj-btn sm pri" :disabled="acting" @click="applyAll(message)">{{ $t('rest.chat.applyAll') }}</button>
        </div>
        <article v-for="suggestion in message.suggestions || []" :key="suggestion.id" class="suggest">
          <div class="suggest-head">
            <b>{{ suggestion.label }}</b>
            <span v-if="suggestion.status === 'applied'" class="cj-tag green">{{ $t('rest.chat.applied') }}</span>
            <span v-else-if="suggestion.status === 'ignored'" class="cj-tag gray">{{ $t('rest.chat.ignored') }}</span>
            <span v-else-if="suggestion.invalid" class="cj-tag red">{{ $t('rest.chat.missingTarget') }}</span>
            <span v-else-if="suggestion.created" class="cj-tag acc">{{ $t('rest.chat.created') }}</span>
          </div>
          <template v-if="suggestion.target_type === 'new_book' && plans[suggestion.id]">
            <label class="check"><el-checkbox v-model="plans[suggestion.id].useTitle">{{ $t('rest.chat.bookTitle') }}</el-checkbox></label>
            <el-input v-model="plans[suggestion.id].title" maxlength="60" size="small" :placeholder="$t('rest.chat.bookTitle')" />
            <label class="check"><el-checkbox v-model="plans[suggestion.id].useWorld">{{ $t('rest.chat.world') }}</el-checkbox></label>
            <el-input v-model="plans[suggestion.id].world" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" size="small" />
            <label class="check"><el-checkbox v-model="plans[suggestion.id].useOutline">{{ $t('rest.chat.outline') }}</el-checkbox></label>
            <el-input v-model="plans[suggestion.id].outline" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" size="small" />
            <div class="check">{{ $t('rest.chat.chapterWords') }} <el-input-number v-model="plans[suggestion.id].chapter_words" :min="300" :max="20000" :step="100" size="small" controls-position="right" /></div>
            <div v-for="(volume, index) in plans[suggestion.id].volumes" :key="index" class="plan-block">
              <label class="check"><el-checkbox v-model="volume.on">{{ $t('rest.chat.volumeN', { name: volume.title || index + 1 }) }}</el-checkbox></label>
              <el-input v-model="volume.title" maxlength="60" size="small" :placeholder="$t('rest.chat.volumeTitlePh')" />
              <el-input v-model="volume.goal" size="small" :placeholder="$t('rest.chat.volumeGoalPh')" />
              <el-input v-model="volume.outline" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" size="small" :placeholder="$t('rest.chat.volumeOutlinePh')" />
              <div v-for="(chapter, chapterIndex) in volume.chapters" :key="chapterIndex" class="plan-chapter">
                <label class="check"><el-checkbox v-model="chapter.on">{{ $t('rest.chat.chapterN', { number: chapter.number || chapterIndex + 1 }) }}</el-checkbox></label>
                <el-input v-model="chapter.title" size="small" :placeholder="$t('rest.chat.chapterTitlePh')" />
                <el-input v-model="chapter.goal" size="small" :placeholder="$t('rest.chat.chapterGoalPh')" />
                <el-input v-model="chapter.conflict" size="small" :placeholder="$t('rest.chat.conflictPh')" />
              </div>
            </div>
            <div v-for="(card, index) in plans[suggestion.id].cards" :key="`c${index}`" class="plan-block">
              <label class="check"><el-checkbox v-model="card.on">{{ card.kind === 'setting' ? $t('rest.chat.setting') : $t('rest.chat.character') }}</el-checkbox></label>
              <el-input v-model="card.name" size="small" :placeholder="$t('rest.chat.namePh')" />
              <el-input v-if="card.kind === 'setting'" v-model="card.content" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" size="small" :placeholder="$t('rest.chat.contentPh')" />
              <el-input v-else v-model="card.role" size="small" :placeholder="$t('rest.chat.rolePh')" />
              <label v-if="card.kind === 'setting'" class="check"><el-checkbox v-model="card.pinned">{{ $t('rest.chat.pin') }}</el-checkbox></label>
            </div>
            <button v-if="suggestion.status === 'pending'" class="cj-btn sm pri" :disabled="acting" @click="createBook(message, suggestion)">{{ $t('rest.chat.createBook') }}</button>
          </template>
          <template v-else>
            <div v-for="change in suggestion.changes" :key="change.field" class="diff">
              <div class="cj-muted">{{ change.label }}</div>
              <template v-if="editingId === suggestion.id">
                <el-input :model-value="editText(change)" size="small" @update:model-value="setEdit(suggestion, change, $event)" />
              </template>
              <template v-else>
                <div v-if="isMobile" class="diff-label">{{ $t('rest.chat.before') }}</div>
                <div class="diff-line">
                  <span v-for="(part, index) in parts(change).before" :key="`b${index}`" :class="part.kind === 'mid' ? 'del' : ''">{{ part.text }}</span>
                </div>
                <div v-if="isMobile" class="diff-label">{{ $t('rest.chat.after') }}</div>
                <div class="diff-line">
                  <span v-for="(part, index) in parts(change).after" :key="`a${index}`" :class="part.kind === 'mid' ? 'add' : ''">{{ part.text }}</span>
                </div>
              </template>
            </div>
            <div v-if="suggestion.status === 'pending' && !suggestion.invalid && suggestion.target_type !== 'new_book'" class="suggest-actions">
              <button class="cj-btn sm pri" :disabled="acting" @click="applyOne(message, suggestion)">{{ $t('rest.chat.apply') }}</button>
              <button v-if="editingId !== suggestion.id" class="cj-btn sm" :disabled="acting" @click="beginEdit(suggestion)">{{ $t('rest.chat.editApply') }}</button>
              <button v-else class="cj-btn sm pri" :disabled="acting" @click="applyOne(message, suggestion, true)">{{ $t('rest.chat.saveApply') }}</button>
              <button class="cj-btn sm ghost" :disabled="acting" @click="ignore(message, suggestion)">{{ $t('rest.chat.ignore') }}</button>
            </div>
          </template>
        </article>
      </div>
      <div v-if="sending" class="bubble assistant">
        <div class="cj-muted">{{ statusLabel }}<template v-if="reasoning">{{ $t('rest.chat.thought', { count: reasoning.length }) }}</template></div>
        <div v-if="live" class="bubble-text">{{ live }}</div>
      </div>
      <p v-if="stopped" class="cj-muted">{{ $t('rest.chat.stopped') }}</p>
      <p v-if="errorText" class="ai-error">{{ errorText }}</p>
    </div>
    <div class="ai-compose">
      <el-input v-model="draft" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :placeholder="$t('rest.chat.placeholder')" @keydown="onKey" />
      <div class="suggest-actions">
        <button v-if="showFill" class="cj-btn sm" :disabled="sending" @click="sendText(fillPrompt)">{{ $t('rest.chat.fill') }}</button>
        <div class="cj-spacer"></div>
        <button v-if="sending" class="cj-btn sm" @click="stop">{{ $t('rest.chat.stop') }}</button>
        <button v-else class="cj-btn sm pri" :disabled="!draft.trim()" @click="sendText(draft)">{{ $t('rest.chat.send') }}</button>
      </div>
    </div>
  </aside>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useIsMobile } from '../../../composables/useIsMobile.js'
import { cjApi, cjStream, promptModelSetup, toastError } from '../api.js'

const { t } = useI18n()
// The chat stream still sends these Chinese status lines. Map them; show anything else as-is.
const STATUS_FROM_SERVER = {
  '已发送给模型': 'sent',
  '思考中': 'thinking',
  '正在回复': 'replying'
}

const { isMobile } = useIsMobile()

const props = defineProps({
  bookId: { type: Number, default: 0 },
  targetType: { type: String, required: true },
  targetId: { type: Number, default: 0 },
  heading: { type: String, default: '' },
  listTitle: { type: String, default: '' },
  showFill: { type: Boolean, default: false },
  fillPrompt: { type: String, default: '' },
  fillTick: { type: Number, default: 0 },
  preferredChatId: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'applied', 'changed', 'created'])

const router = useRouter()
const headingText = computed(() => props.heading || t('rest.chat.heading'))
const model = reactive({ loaded: false, ready: false, fallback: false })
const chats = ref([])
const activeId = ref(0)
const messages = ref([])
const phrase = ref('')
const draft = ref('')
const sending = ref(false)
const acting = ref(false)
const statusCode = ref('sent')
const statusExtra = ref('')
const live = ref('')
const reasoning = ref('')
const errorText = ref('')
const stopped = ref(false)
const statusLabel = computed(() => statusExtra.value || t(`rest.chat.status.${statusCode.value || 'sent'}`))
const setStatus = (code) => {
  statusCode.value = code
  statusExtra.value = ''
}
const applyServerStatus = (text) => {
  const code = STATUS_FROM_SERVER[text]
  if (code) setStatus(code)
  else if (text) {
    statusCode.value = ''
    statusExtra.value = text
  } else setStatus('sent')
}
const editingId = ref('')
const editBuffer = ref(null)
const plans = reactive({})
const log = ref(null)
let abortHandle = null
let reloadTimer = null

const settingsTo = computed(() => (props.bookId ? `/changjuan/book/${props.bookId}/settings` : '/changjuan/settings'))

const createBody = () => {
  const body = { target_type: props.targetType }
  if (props.listTitle) body.title = props.listTitle
  if (props.bookId) body.book_id = props.bookId
  if (props.targetId) body.target_id = props.targetId
  return body
}

const scrollDown = () => nextTick(() => { if (log.value) log.value.scrollTop = log.value.scrollHeight })

const loadModel = async () => {
  try {
    const json = await cjApi('/ai/model')
    Object.assign(model, json.data, { loaded: true })
  } catch (err) {
    model.loaded = true
    toastError(err)
  }
}

const loadList = async () => {
  const query = new URLSearchParams({ target_type: props.targetType })
  if (props.bookId) query.set('book_id', String(props.bookId))
  if (props.targetId) query.set('target_id', String(props.targetId))
  const json = await cjApi(`/ai/chats?${query}`)
  let rows = json.data || []
  if (!props.targetId && props.listTitle) rows = rows.filter(item => item.title === props.listTitle)
  chats.value = rows
}

const rememberPlans = (list) => {
  for (const message of list || []) {
    for (const suggestion of message.suggestions || []) {
      if (suggestion.target_type !== 'new_book' || plans[suggestion.id]) continue
      const fields = suggestion.plan || suggestion.fields || {}
      plans[suggestion.id] = {
        useTitle: true,
        title: fields.title || '',
        useWorld: fields.world !== undefined,
        world: fields.world || '',
        useOutline: fields.outline !== undefined,
        outline: fields.outline || '',
        chapter_words: fields.chapter_words || 2500,
        volumes: (fields.volumes || []).map(volume => ({
          on: true,
          title: volume.title || '',
          goal: volume.goal || '',
          outline: volume.outline || '',
          chapters: (volume.chapters || []).map(chapter => ({ on: true, ...chapter }))
        })),
        cards: (fields.cards || []).map(card => ({
          on: true,
          kind: card.kind,
          name: card.name || '',
          category: card.category || '',
          content: card.data?.content || card.content || '',
          role: card.data?.role || card.role || '',
          pinned: !!(card.data?.pinned || card.pinned)
        }))
      }
    }
  }
}

const loadChat = async () => {
  errorText.value = ''
  if (!activeId.value) {
    messages.value = []
    phrase.value = ''
    return
  }
  const json = await cjApi(`/ai/chats/${activeId.value}`)
  messages.value = json.data.messages || []
  phrase.value = json.data.context?.phrase || ''
  if (json.data.model) Object.assign(model, json.data.model, { loaded: true })
  rememberPlans(messages.value)
  const known = new Set(chats.value.map(item => item.id))
  if (!known.has(json.data.id)) await loadList()
  scrollDown()
}

const ensureChat = async () => {
  if (activeId.value) return activeId.value
  const json = await cjApi('/ai/chats', { method: 'POST', body: createBody() })
  activeId.value = json.data.id
  await loadList()
  emit('changed')
  return activeId.value
}

const sendText = async (text) => {
  const value = String(text || '').trim()
  if (!value || sending.value) return
  sending.value = true
  setStatus('sent')
  live.value = ''
  reasoning.value = ''
  errorText.value = ''
  stopped.value = false
  const controller = new AbortController()
  abortHandle = controller
  try {
    const id = await ensureChat()
    await cjStream(`/ai/chats/${id}/messages`, { content: value }, (event) => {
      if (event.type === 'status') applyServerStatus(event.text)
      else if (event.type === 'context') {
        phrase.value = event.data?.phrase || phrase.value
        setStatus('sent')
      } else if (event.type === 'reasoning') {
        setStatus('thinking')
        reasoning.value += event.text || ''
      } else if (event.type === 'delta') {
        setStatus('replying')
        live.value += event.text || ''
        scrollDown()
      } else if (event.type === 'error') errorText.value = event.message || t('rest.chat.failed')
    }, controller.signal)
    if (controller.signal.aborted) stopped.value = true
    draft.value = ''
  } catch (err) {
    if (!(await promptModelSetup(err, () => router.push(settingsTo.value)))) toastError(err)
  } finally {
    sending.value = false
    await loadChat().catch(() => {})
    emit('changed')
    if (abortHandle?.signal?.aborted) {
      clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => { loadChat().catch(() => {}) }, 1500)
    }
  }
}

const stop = () => abortHandle?.abort()

const onKey = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendText(draft.value)
  }
}

const parts = (change) => {
  const left = String(change.before ?? '')
  const right = String(change.after ?? '')
  let start = 0
  const max = Math.min(left.length, right.length)
  while (start < max && left[start] === right[start]) start += 1
  let endL = left.length
  let endR = right.length
  while (endL > start && endR > start && left[endL - 1] === right[endR - 1]) {
    endL -= 1
    endR -= 1
  }
  const pack = (text, from, to) => {
    if (!text) return [{ text: t('rest.chat.emptyValue'), kind: 'mid' }]
    return [
      { text: text.slice(0, from), kind: 'same' },
      { text: text.slice(from, to), kind: 'mid' },
      { text: text.slice(to), kind: 'same' }
    ].filter(part => part.text)
  }
  return { before: pack(left, start, endL), after: pack(right, start, endR) }
}

const pendingCount = (message) => (message.suggestions || []).filter(item => item.status === 'pending' && !item.invalid && item.target_type !== 'new_book').length

const beginEdit = (suggestion) => {
  editingId.value = suggestion.id
  editBuffer.value = JSON.parse(JSON.stringify(suggestion.fields || {}))
}

const editText = (change) => {
  const buf = editBuffer.value || {}
  if (buf.data && Object.prototype.hasOwnProperty.call(buf.data, change.field)) {
    const value = buf.data[change.field]
    return typeof value === 'boolean' ? (value ? t('rest.chat.yes') : t('rest.chat.no')) : String(value ?? '')
  }
  const value = buf[change.field]
  return Array.isArray(value) ? value.join(t('rest.chat.listSep')) : String(value ?? '')
}

// Accept the stored Chinese yes, plus true/yes, so an English "Yes" still pins the card.
const pinnedOn = (value) => {
  const text = String(value).trim().toLowerCase()
  return text === 'true' || text === 'yes' || text === '是' || text === String(t('rest.chat.yes')).trim().toLowerCase()
}

const setEdit = (suggestion, change, value) => {
  const buf = editBuffer.value
  if (!buf) return
  if (buf.data && Object.prototype.hasOwnProperty.call(buf.data, change.field)) {
    buf.data[change.field] = change.field === 'pinned' ? pinnedOn(value) : value
    return
  }
  if (change.field === 'characters') buf.characters = String(value).split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  else if (['target_words', 'chapter_words', 'number', 'foreshadow_remind', 'volume_id'].includes(change.field)) buf[change.field] = value === '' ? null : Number(value)
  else buf[change.field] = value
  if (suggestion.target_type === 'card' && !['name', 'aliases', 'category', 'kind'].includes(change.field)) {
    buf.data = buf.data || {}
    buf.data[change.field] = change.field === 'pinned' ? pinnedOn(value) : value
  }
}

const runAction = async (path, body) => {
  acting.value = true
  try {
    const json = await cjApi(path, { method: 'POST', body })
    editingId.value = ''
    await loadChat()
    emit('applied', json.data?.created || null)
    return json
  } catch (err) {
    toastError(err)
    return null
  } finally {
    acting.value = false
  }
}

const applyOne = (message, suggestion, edit) => runAction(`/ai/chats/${activeId.value}/apply`, {
  message_id: message.id,
  ids: [suggestion.id],
  ...(edit ? { edits: { [suggestion.id]: editBuffer.value } } : {})
})

const applyAll = (message) => runAction(`/ai/chats/${activeId.value}/apply`, { message_id: message.id, all: true })

const ignore = (message, suggestion) => runAction(`/ai/chats/${activeId.value}/apply`, {
  message_id: message.id,
  ignore_ids: [suggestion.id]
})

const planPayload = (state) => {
  const plan = {}
  if (state.useTitle && String(state.title || '').trim()) plan.title = String(state.title).trim()
  if (state.chapter_words) plan.chapter_words = Number(state.chapter_words)
  if (state.useWorld) plan.world = state.world
  if (state.useOutline) plan.outline = state.outline
  const volumes = state.volumes.filter(volume => volume.on).map(volume => ({
    title: volume.title,
    goal: volume.goal,
    outline: volume.outline,
    chapters: (volume.chapters || []).filter(chapter => chapter.on).map(chapter => ({
      number: chapter.number,
      title: chapter.title,
      goal: chapter.goal,
      conflict: chapter.conflict,
      payoff: chapter.payoff,
      hook: chapter.hook,
      characters: chapter.characters,
      target_words: chapter.target_words
    }))
  }))
  if (volumes.length) plan.volumes = volumes
  const cards = state.cards.filter(card => card.on).map(card => (card.kind === 'setting'
    ? { kind: 'setting', name: card.name, category: card.category, content: card.content, pinned: !!card.pinned }
    : { kind: 'character', name: card.name, role: card.role }))
  if (cards.length) plan.cards = cards
  return plan
}

const createBook = async (message, suggestion) => {
  const state = plans[suggestion.id]
  if (!state) return
  acting.value = true
  try {
    const json = await cjApi(`/ai/chats/${activeId.value}/create-book`, {
      method: 'POST',
      body: { message_id: message.id, suggestion_id: suggestion.id, plan: planPayload(state) }
    })
    emit('created', json.data)
    router.push(`/changjuan/book/${json.data.id}/outline`)
  } catch (err) {
    toastError(err)
  } finally {
    acting.value = false
  }
}

watch(() => props.fillTick, (value) => { if (value) sendText(props.fillPrompt) })

onMounted(async () => {
  await loadModel()
  try {
    await loadList()
    const preferred = chats.value.find(item => item.id === props.preferredChatId)
    activeId.value = preferred?.id || chats.value[0]?.id || 0
    if (activeId.value) await loadChat()
  } catch (err) {
    toastError(err)
  }
})
</script>

<style scoped>
.ai-panel { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--cj-line); background: var(--cj-paper); }
.ai-head, .ai-compose { padding: 12px; border-bottom: 1px solid var(--cj-line); }
.ai-head { display: flex; flex-direction: column; gap: 4px; }
.ai-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.ai-head-row b { flex: 1; min-width: 0; font-size: 14px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-head-row .cj-btn { flex-shrink: 0; white-space: nowrap; }
.ai-phrase { font-size: 12px; line-height: 1.6; }
.ai-banner { margin: 0; padding: 8px 12px; background: var(--cj-amber-soft); color: var(--cj-ink); font-size: 12px; line-height: 1.6; }
.ai-banner a { margin-left: 6px; color: var(--cj-accent); }
.ai-log { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.ai-empty { line-height: 1.7; }
.bubble { border-radius: 8px; padding: 8px 10px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.bubble.user { background: var(--cj-accent-soft); align-self: flex-end; max-width: 100%; }
.bubble.assistant { background: var(--cj-gray-soft); }
.bubble-text { white-space: pre-wrap; }
.suggest { margin-top: 8px; border: 1px solid var(--cj-line); border-radius: 8px; padding: 8px; background: var(--cj-paper); }
.suggest-head, .suggest-actions, .check { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.suggest-head { margin-bottom: 6px; }
.suggest-actions { margin-top: 8px; }
.diff { margin: 6px 0; font-size: 12px; line-height: 1.6; }
.diff-line { white-space: pre-wrap; }
.del { background: var(--cj-red-soft); text-decoration: line-through; }
.add { background: var(--cj-green-soft); }
.plan-block, .plan-chapter { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.plan-chapter { margin-left: 8px; }
.ai-compose { border-bottom: none; border-top: 1px solid var(--cj-line); }
.ai-error { color: var(--cj-red); margin: 0; }
@media (max-width: 768px) {
  .ai-panel { width: 100%; max-height: 70vh; border-left: none; border-top: 1px solid var(--cj-line); }
}
.ai-panel.is-mobile {
  position: fixed;
  top: var(--cj-vv-top, 0px);
  left: 0;
  width: 100%;
  height: var(--cj-vv-height, 100%);
  max-height: none;
  z-index: 4000;
  border: none;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}
.ai-panel.is-mobile .cj-btn { min-height: 44px; }
.ai-panel.is-mobile .suggest-actions .cj-btn { flex: 1 1 calc(50% - 6px); }
.ai-panel.is-mobile .diff { font-size: 14px; }
.ai-panel.is-mobile .diff-label { font-size: 12px; color: var(--cj-sub); margin-top: 4px; }
.ai-panel.is-mobile .diff-line { display: block; }
.ai-panel.is-mobile .ai-head button { min-width: 64px; }
</style>
