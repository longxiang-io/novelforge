<template>
  <div class="cj-main" :class="{ 'is-mobile': isMobile }">
    <div v-if="isMobile" class="m-mem">
      <el-input v-model="keyword" :placeholder="$t('write.memory.searchMobile')" clearable />
      <section class="m-group">
        <h2>{{ $t('rest.chat.character') }}</h2>
        <button v-for="card in mobileCharacters" :key="card.id" type="button" class="m-card" @click="openMobileCard(card)">
          <span class="avatar">{{ card.name.charAt(0) }}</span>
          <span class="m-card-text"><b>{{ card.name }}</b><small>{{ cardSubtitle(card) }}</small></span>
        </button>
        <p v-if="!mobileCharacters.length" class="cj-muted">{{ keyword ? $t('write.memory.noMatchCharacters') : $t('write.memory.noCharacters') }}</p>
      </section>
      <section class="m-group">
        <h2>{{ $t('rest.chat.setting') }}</h2>
        <button v-for="card in mobileSettings" :key="card.id" type="button" class="m-card" @click="openMobileCard(card)">
          <span class="avatar">{{ card.name.charAt(0) }}</span>
          <span class="m-card-text"><b>{{ card.name }}</b><small>{{ cardSubtitle(card) }}</small></span>
        </button>
        <p v-if="!mobileSettings.length" class="cj-muted">{{ keyword ? $t('write.memory.noMatchSettings') : $t('write.memory.noSettings') }}</p>
      </section>
      <section class="m-group">
        <h2>{{ $t('write.memory.summary') }}</h2>
        <button v-for="item in filteredSummaries" :key="item.id" type="button" class="m-card" @click="openMobileSummary(item)">
          <span class="avatar">{{ item.number }}</span>
          <span class="m-card-text"><b>{{ item.title }}</b><small>{{ $t('write.memory.chapterSummary', { number: item.number }) }}</small></span>
        </button>
        <p v-if="!filteredSummaries.length" class="cj-muted">{{ $t('write.memory.summariesAfterConfirm') }}</p>
      </section>
      <div v-if="loading" class="cj-empty">{{ $t('rest.read.loading') }}</div>
      <div v-else-if="error" class="cj-error-box">{{ error }}</div>
      <button v-show="keyboardInset < 80" type="button" class="m-fab" @click="fabOpen = true">{{ $t('shell.shelf.new') }}</button>
      <div v-if="summaryOpen && activeSummary" class="m-summary">
        <div class="m-summary-bar">
          <button type="button" class="cj-btn" @click="summaryOpen = false">{{ $t('shell.layout.back') }}</button>
          <b>{{ $t('rest.context.chapter', { number: activeSummary.number }) }}</b>
        </div>
        <h2 class="cj-serif">{{ activeSummary.title }}</h2>
        <p class="cj-serif summary-text">{{ activeSummary.summary }}</p>
        <button type="button" class="cj-btn" :disabled="summarizing" @click="regenerateSummary">{{ summarizing ? $t('rest.chapter.generating') : $t('rest.chapter.regenerate') }}</button>
      </div>
      <div v-if="fabOpen" class="m-fab-mask" @click.self="fabOpen = false">
        <div class="m-fab-sheet">
          <button type="button" @click="createFromFab('character')">{{ $t('rest.context.createCard') }}</button>
          <button type="button" @click="createFromFab('setting')">{{ $t('write.memory.newSetting') }}</button>
          <button type="button" @click="fabOpen = false; askNewCard()">{{ $t('write.memory.letAiCreate') }}</button>
          <button type="button" @click="fabOpen = false">{{ $t('rest.stats.cancel') }}</button>
        </div>
      </div>
    </div>
    <aside v-show="!isMobile" class="mem-side">
      <div class="kind-tabs">
        <button v-for="tab in kindTabs" :key="tab.key" class="kind" :class="{ on: kind === tab.key }" @click="switchKind(tab.key)">{{ tab.label }} {{ tab.count }}</button>
      </div>
      <el-input v-model="keyword" :placeholder="$t('write.memory.searchDesktop')" clearable size="small" style="margin: 10px 0" />
      <div class="mem-list">
        <template v-if="kind !== 'summary'">
          <div v-for="card in filteredCards" :key="card.id" class="mem-item" :class="{ on: card.id === activeId, dead: card.data.alive === STORED_NO }" @click="activeId = card.id">
            <span class="avatar">{{ card.name.charAt(0) }}</span>
            <div class="mem-text">
              <b>{{ card.name }}</b>
              <small class="cj-muted">{{ cardSubtitle(card) }}</small>
            </div>
          </div>
          <div v-if="!filteredCards.length" class="cj-muted" style="padding: 12px 8px">{{ keyword ? $t('write.memory.noMatchCards') : $t('write.memory.noCards') }}</div>
          <button class="cj-btn sm block" style="margin-top: 8px" @click="openEditor(null)">＋ {{ kind === 'character' ? $t('rest.context.createCard') : $t('write.memory.newSetting') }}</button>
          <button class="cj-btn sm ghost block" style="margin-top: 6px" @click="askNewCard">{{ $t('write.memory.letAiCreate') }}</button>
        </template>
        <template v-else>
          <div v-for="item in filteredSummaries" :key="item.id" class="mem-item" :class="{ on: item.id === activeSummaryId }" @click="activeSummaryId = item.id">
            <span class="avatar">{{ item.number }}</span>
            <div class="mem-text"><b>{{ item.title }}</b><small class="cj-muted">{{ $t('write.memory.chapterSummary', { number: item.number }) }}</small></div>
          </div>
          <div v-if="!filteredSummaries.length" class="cj-muted" style="padding: 12px 8px; line-height: 1.8">{{ $t('write.memory.summariesAfterConfirm') }}</div>
        </template>
      </div>
    </aside>

    <div v-show="!isMobile" class="cj-page mem-page">
      <div v-if="loading" class="cj-empty">{{ $t('rest.read.loading') }}</div>
      <div v-else-if="error" class="cj-error-box">{{ error }}</div>
      <template v-else-if="kind === 'summary'">
        <div v-if="activeSummary" class="cj-card detail" style="max-width: 760px">
          <div class="cj-serif" style="font-size: 20px; font-weight: 700">{{ $t('rest.chapter.head', { number: activeSummary.number, title: activeSummary.title }) }}</div>
          <p class="cj-serif summary-text">{{ activeSummary.summary }}</p>
          <button class="cj-btn sm" :disabled="summarizing" @click="regenerateSummary">{{ summarizing ? $t('rest.chapter.generating') : $t('rest.chapter.regenerate') }}</button>
        </div>
        <div v-else class="cj-empty">{{ $t('write.memory.pickSummary') }}</div>
      </template>
      <div v-else-if="activeCard" class="mem-grid">
        <div class="cj-card detail">
          <div class="detail-head">
            <span class="avatar big">{{ activeCard.name.charAt(0) }}</span>
            <div>
              <div class="cj-serif" style="font-size: 20px; font-weight: 700">{{ activeCard.name }}</div>
              <div class="cj-muted" style="font-size: 12px">
                <template v-if="activeCard.aliases">{{ $t('write.memory.aliasesInline', { names: activeCard.aliases }) }}</template>
                <template v-if="activeCard.kind === 'character' && activeCard.data.last_seen"> · {{ $t('write.memory.lastSeenInline', { number: activeCard.data.last_seen }) }}</template>
                <template v-if="activeCard.kind === 'setting'">{{ activeCard.category ? categoryLabel(activeCard.category) : $t('write.memory.uncategorized') }}{{ activeCard.data.pinned ? $t('write.memory.pinnedSuffix') : '' }}</template>
              </div>
            </div>
            <div class="cj-spacer"></div>
            <button v-if="cardBlank" class="cj-btn sm" @click="askFill">{{ $t('rest.chat.fill') }}</button>
            <button class="cj-btn sm" @click="openCardChat(activeCard)">{{ $t('rest.chat.heading') }}</button>
            <button class="cj-btn sm" @click="openEditor(activeCard)">{{ $t('write.common.edit') }}</button>
            <button class="cj-btn sm" @click="router.push(`/changjuan/book/${bookId}/versions`)">{{ $t('nav.versions') }}</button>
            <button class="cj-btn sm ghost danger" @click="removeCard(activeCard)">{{ $t('rest.stats.delete') }}</button>
          </div>
          <template v-if="activeCard.kind === 'character'">
            <div class="cj-section-title">{{ $t('write.memory.profile') }}</div>
            <div class="cj-kv">
              <template v-for="[key] in CHARACTER_BASE_FIELDS" :key="key">
                <div class="k">{{ fieldLabel(key) }}</div><div>{{ displayField(key, activeCard.data[key]) }}</div>
              </template>
            </div>
            <div class="cj-section-title" style="margin-top: 18px">{{ $t('write.memory.currentState') }}</div>
            <div class="cj-kv">
              <template v-for="[key] in CHARACTER_STATE_FIELDS" :key="key">
                <div class="k">{{ fieldLabel(key) }}<template v-if="KEY_STATE_FIELDS.includes(key)"> 🔒</template></div>
                <div>
                  {{ displayField(key, activeCard.data[key]) }}
                  <span v-for="item in pendingFor(activeCard, key)" :key="item.number" class="cj-tag red" style="margin-left: 8px">{{ $t('write.memory.pendingChange', { number: item.number, value: displayPending(key, item.new_value) }) }}</span>
                </div>
              </template>
            </div>
            <div class="cj-muted" style="font-size: 11px; margin-top: 10px">🔒 {{ $t('write.memory.keyStateNote') }}</div>
          </template>
          <template v-else>
            <div class="cj-section-title">{{ $t('rest.chat.contentPh') }}</div>
            <p class="cj-serif summary-text">{{ activeCard.data.content || '—' }}</p>
          </template>
        </div>
        <div class="side-cards">
          <div v-if="activeCard.kind === 'character'" class="cj-card side-card">
            <b>{{ $t('write.memory.relations') }}</b>
            <div class="cj-kv" style="margin-top: 8px">
              <template v-for="item in activeCard.data.relations || []" :key="item.name">
                <div class="k">{{ item.name }}</div><div>{{ item.desc }}</div>
              </template>
            </div>
            <div v-if="!(activeCard.data.relations || []).length" class="cj-muted" style="margin-top: 8px">{{ $t('write.memory.noRelations') }}</div>
          </div>
          <div class="cj-card side-card">
            <div style="display: flex; justify-content: space-between"><b>{{ $t('write.memory.historyTitle') }}</b><span class="cj-muted" style="font-size: 12px">{{ $t('write.memory.historyHint') }}</span></div>
            <div v-for="(item, index) in history" :key="index" class="history-row">
              <span class="cj-muted">{{ item.chapter_number ? $t('rest.context.chapter', { number: item.chapter_number }) : 'AI' }}</span>
              <span class="history-text">{{ item.field_label }} {{ item.old || '' }}{{ item.old ? ' → ' : '＋ ' }}{{ item.new }}</span>
              <span class="cj-tag" :class="historyColor(item.state)">{{ historyLabel(item.state) }}</span>
            </div>
            <div v-if="!history.length" class="cj-muted" style="margin-top: 8px">{{ $t('write.memory.noHistory') }}</div>
          </div>
        </div>
      </div>
      <div v-else class="cj-empty">{{ $t('write.memory.pickCard') }}</div>
    </div>
    <AiChatPanel v-if="chatOpen" :key="chatKey" :book-id="bookId" :target-type="'card'" :target-id="chatCardId" :heading="chatHeading" :list-title="chatListTitle" :show-fill="chatShowFill" :fill-prompt="chatFillPrompt" :fill-tick="fillTick" @close="chatOpen = false" @applied="onAiApplied" />

    <el-dialog v-model="editorVisible" :title="editing.id ? $t('write.memory.editCard') : (editing.kind === 'character' ? $t('rest.context.createCard') : $t('write.memory.newSetting'))" width="620px" :fullscreen="isMobile" class="cj-dialog" append-to-body>
      <div class="edit-grid">
        <div class="cj-form-row"><label>{{ $t('rest.chat.namePh') }}</label><el-input v-model="editing.name" maxlength="60" /></div>
        <div class="cj-form-row"><label>{{ $t('write.memory.aliasesLabel') }}</label><el-input v-model="editing.aliases" maxlength="200" /></div>
        <template v-if="editing.kind === 'character'">
          <div v-for="[key] in CHARACTER_BASE_FIELDS" :key="key" class="cj-form-row"><label>{{ fieldLabel(key) }}</label><el-input v-model="editing.data[key]" /></div>
          <div v-for="[key] in CHARACTER_STATE_FIELDS" :key="key" class="cj-form-row">
            <label>{{ fieldLabel(key) }}<template v-if="KEY_STATE_FIELDS.includes(key)"> 🔒</template></label>
            <el-select v-if="key === 'alive' || key === 'present'" v-model="editing.data[key]" popper-class="cj-popper" style="width: 100%">
              <el-option :label="$t('rest.chat.yes')" :value="STORED_YES" /><el-option :label="$t('rest.chat.no')" :value="STORED_NO" />
            </el-select>
            <el-input v-else v-model="editing.data[key]" />
          </div>
          <div class="cj-form-row full">
            <label>{{ $t('write.memory.relations') }}</label>
            <div v-for="(item, index) in editing.data.relations" :key="index" class="relation-row">
              <el-input v-model="item.name" :placeholder="$t('rest.chat.character')" style="width: 140px" />
              <el-input v-model="item.desc" :placeholder="$t('write.memory.relationPlaceholder')" />
              <button class="cj-btn sm ghost" @click="editing.data.relations.splice(index, 1)">{{ $t('rest.stats.delete') }}</button>
            </div>
            <button class="cj-btn sm" @click="editing.data.relations.push({ name: '', desc: '' })">＋ {{ $t('write.memory.addRelation') }}</button>
          </div>
        </template>
        <template v-else>
          <div class="cj-form-row">
            <label>{{ $t('write.memory.category') }}</label>
            <el-select v-model="editing.category" popper-class="cj-popper" style="width: 100%">
              <el-option v-for="item in SETTING_CATEGORIES" :key="item" :label="categoryLabel(item)" :value="item" />
            </el-select>
          </div>
          <div class="cj-form-row" style="display: flex; align-items: flex-end"><el-checkbox v-model="editing.data.pinned">{{ $t('write.memory.pinEveryChapter') }}</el-checkbox></div>
          <div class="cj-form-row full"><label>{{ $t('rest.chat.contentPh') }}</label><el-input v-model="editing.data.content" type="textarea" :rows="5" maxlength="5000" /></div>
        </template>
      </div>
      <div v-if="editing.id && editing.kind === 'character'" class="cj-muted" style="font-size: 12px">{{ $t('write.memory.directEditNote') }}</div>
      <template #footer>
        <div class="cj-dialog-footer">
          <button class="cj-btn" @click="chatFromEditor">{{ $t('rest.chat.heading') }}</button>
          <button class="cj-btn" @click="editorVisible = false">{{ $t('rest.stats.cancel') }}</button>
          <button class="cj-btn pri" :disabled="saving" @click="saveCard">{{ $t('rest.stats.save') }}</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AiChatPanel from './components/AiChatPanel.vue'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { CHARACTER_BASE_FIELDS, CHARACTER_STATE_FIELDS, KEY_STATE_FIELDS, SETTING_CATEGORIES, categoryLabel, cjApi, fieldLabel, promptModelSetup, toastError } from './api.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isMobile, keyboardInset } = useIsMobile()
const { bookId } = inject('cj')

// Saved cards keep these Chinese tokens. Only the labels are translated.
const STORED_YES = '是'
const STORED_NO = '否'
const DEFAULT_SETTING_CATEGORY = '地点'

const HISTORY_COLOR = {
  pending: 'red',
  auto_pending: 'gray',
  auto: 'gray',
  confirmed: 'gray'
}
const historyColor = (state) => HISTORY_COLOR[state] || 'gray'
const historyLabel = (state) => {
  if (state === 'auto') return t('write.memory.historyAuto')
  if (state === 'confirmed') return t('rest.chapter.confirmed')
  return t('write.memory.historyPending')
}

const kind = ref('character')
const cards = ref([])
const pending = ref([])
const summaries = ref([])
const keyword = ref('')
const activeId = ref(0)
const activeSummaryId = ref(0)
const history = ref([])
const loading = ref(true)
const error = ref('')
const editorVisible = ref(false)
const editing = ref({ kind: 'character', data: {} })
const saving = ref(false)
const summarizing = ref(false)
const chatOpen = ref(false)
const chatCardId = ref(0)
const chatListTitle = ref('')
const chatHeading = ref('')
const chatShowFill = ref(false)
const chatFillPrompt = ref('')
const fillTick = ref(0)
const chatKey = ref('card:0')
const fabOpen = ref(false)
const summaryOpen = ref(false)

const characters = computed(() => cards.value.filter(card => card.kind === 'character'))
const settings = computed(() => cards.value.filter(card => card.kind === 'setting'))
const kindTabs = computed(() => [
  { key: 'character', label: t('rest.chat.character'), count: characters.value.length },
  { key: 'setting', label: t('rest.chat.setting'), count: settings.value.length },
  { key: 'summary', label: t('write.memory.summary'), count: summaries.value.length }
])
const matches = (text) => !keyword.value || String(text).includes(keyword.value.trim())
const cardText = (card) => `${card.name} ${card.aliases} ${card.category} ${JSON.stringify(card.data)}`
const filteredCards = computed(() => (kind.value === 'character' ? characters.value : settings.value)
  .filter(card => matches(cardText(card))))
const mobileCharacters = computed(() => characters.value.filter(card => matches(cardText(card))))
const mobileSettings = computed(() => settings.value.filter(card => matches(cardText(card))))
const filteredSummaries = computed(() => summaries.value.filter(item => matches(`${item.title} ${item.summary}`)))
const activeCard = computed(() => cards.value.find(card => card.id === activeId.value && card.kind === kind.value) || null)
const activeSummary = computed(() => summaries.value.find(item => item.id === activeSummaryId.value) || null)

const cardBlankOf = (card) => {
  if (!card) return false
  const data = card.data || {}
  if (card.kind === 'setting') return !String(data.content || '').trim()
  return ![data.role, data.appearance, data.personality, data.catchphrase, data.arc].some(value => String(value || '').trim())
}
const cardBlank = computed(() => cardBlankOf(activeCard.value))

const fillPromptFor = (card, creating) => {
  if (creating && card?.kind === 'setting') return t('write.memory.fillCreateSetting')
  if (creating) return t('write.memory.fillCreateCharacter')
  if (card?.kind === 'setting') return t('write.memory.fillSetting')
  return t('write.memory.fillCharacter')
}

const displayYesNo = (value) => {
  if (value === STORED_YES) return t('rest.chat.yes')
  if (value === STORED_NO) return t('rest.chat.no')
  return value
}

const displayField = (key, value) => {
  if (value === undefined || value === null || value === '' || (key === 'last_seen' && !value)) return '—'
  if (key === 'last_seen') return t('rest.context.chapter', { number: value })
  if (key === 'alive' || key === 'present') return displayYesNo(value)
  return value
}

const displayPending = (key, value) => ((key === 'alive' || key === 'present') ? displayYesNo(value) : value)

const openCardChat = async (card, { fill = false, creating = false } = {}) => {
  const setting = (card?.kind || kind.value) === 'setting'
  chatCardId.value = card?.id || 0
  chatListTitle.value = card?.id ? '' : t(setting ? 'write.memory.newSettingShort' : 'write.memory.newCharacterShort')
  chatHeading.value = card?.id
    ? t(setting ? 'write.memory.settingHeading' : 'write.memory.characterHeading', { name: card.name })
    : t(setting ? 'write.memory.newSettingShort' : 'write.memory.newCharacterShort')
  chatShowFill.value = creating || cardBlankOf(card)
  chatFillPrompt.value = fillPromptFor(card || { kind: kind.value }, creating || !card?.id)
  chatKey.value = card?.id ? `card:${card.id}` : `card:new:${card?.kind || kind.value}`
  chatOpen.value = true
  if (fill) {
    await nextTick()
    fillTick.value += 1
  }
}

const askFill = () => openCardChat(activeCard.value, { fill: true })
const askNewCard = () => openCardChat(null, { fill: true, creating: true })
const chatFromEditor = () => {
  const value = editing.value
  editorVisible.value = false
  openCardChat(value?.id ? value : { kind: value?.kind || kind.value }, { creating: !value?.id })
}

const onAiApplied = async (created) => {
  await load()
  const cardId = created?.cards?.[0]?.id
  if (cardId) {
    const card = cards.value.find(item => item.id === cardId)
    if (card) {
      kind.value = card.kind
      activeId.value = card.id
    }
  }
  loadHistory()
}

const cardSubtitle = (card) => {
  if (card.kind === 'setting') return card.category ? categoryLabel(card.category) : t('rest.chat.setting')
  const data = card.data || {}
  if (data.alive === STORED_NO) return data.last_seen ? t('write.memory.deadAt', { number: data.last_seen }) : t('write.memory.dead')
  if (data.present === STORED_NO) return t('write.memory.offstage')
  return [data.role, data.realm].filter(Boolean).join(' · ') || data.location || '—'
}

const pendingFor = (card, field) => pending.value.filter(item => item.target_name === card.name && item.field === field)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const json = await cjApi(`/books/${bookId.value}/cards`)
    cards.value = json.data.cards
    pending.value = json.data.pending
    summaries.value = json.data.summaries
    const wanted = route.query.card ? cards.value.find(card => card.name === route.query.card) : null
    if (wanted) {
      kind.value = wanted.kind
      activeId.value = wanted.id
      if (isMobile.value) openEditor(wanted)
    } else if (!activeCard.value) {
      activeId.value = filteredCards.value[0]?.id || 0
    }
    if (!activeSummary.value) activeSummaryId.value = summaries.value[summaries.value.length - 1]?.id || 0
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const loadHistory = async () => {
  history.value = []
  if (!activeCard.value) return
  try {
    const json = await cjApi(`/cards/${activeCard.value.id}/history`)
    history.value = json.data
  } catch (err) {
    toastError(err)
  }
}

watch(activeId, loadHistory)
const switchKind = (value) => {
  kind.value = value
  if (value !== 'summary') activeId.value = filteredCards.value[0]?.id || 0
}

const openMobileCard = (card) => {
  kind.value = card.kind
  activeId.value = card.id
  openEditor(card)
}

const openMobileSummary = (item) => {
  activeSummaryId.value = item.id
  summaryOpen.value = true
}

const createFromFab = (nextKind) => {
  fabOpen.value = false
  kind.value = nextKind
  openEditor(null)
}

const openEditor = (card) => {
  const base = card
    ? JSON.parse(JSON.stringify(card))
    : { kind: kind.value, name: '', aliases: '', category: kind.value === 'setting' ? DEFAULT_SETTING_CATEGORY : '', data: kind.value === 'character' ? { alive: STORED_YES, present: STORED_YES } : { content: '', pinned: false } }
  if (base.kind === 'character' && !Array.isArray(base.data.relations)) base.data.relations = []
  editing.value = base
  editorVisible.value = true
}

const saveCard = async () => {
  const value = editing.value
  if (!value.name?.trim()) return ElMessage.warning(t('write.memory.nameRequired'))
  saving.value = true
  try {
    const body = { book_id: bookId.value, kind: value.kind, name: value.name, aliases: value.aliases, category: value.category, data: value.data }
    const json = value.id
      ? await cjApi(`/cards/${value.id}`, { method: 'PUT', body })
      : await cjApi('/cards', { method: 'POST', body })
    ElMessage.success(t('rest.outlineForm.saved'))
    editorVisible.value = false
    await load()
    activeId.value = json.data.id
    loadHistory()
  } catch (err) {
    toastError(err)
  } finally {
    saving.value = false
  }
}

const removeCard = async (card) => {
  try {
    await ElMessageBox.confirm(t('write.memory.deleteMessage', { name: card.name }), t('write.memory.deleteTitle'), { confirmButtonText: t('rest.stats.delete'), cancelButtonText: t('rest.stats.cancel'), type: 'warning' })
  } catch {
    return
  }
  try {
    await cjApi(`/cards/${card.id}`, { method: 'DELETE' })
    activeId.value = 0
    await load()
  } catch (err) {
    toastError(err)
  }
}

const regenerateSummary = async () => {
  summarizing.value = true
  try {
    await cjApi(`/chapters/${activeSummary.value.id}/summary`, { method: 'POST' })
    ElMessage.success(t('rest.chapter.summaryDone'))
    await load()
  } catch (err) {
    if (!(await promptModelSetup(err, () => router.push(`/changjuan/book/${bookId.value}/settings`)))) toastError(err)
  } finally {
    summarizing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.cj-main { flex: 1; display: flex; min-height: 0; }
.mem-side { width: 236px; background: var(--cj-paper); border-right: 1px solid var(--cj-line); padding: 14px 10px; display: flex; flex-direction: column; flex-shrink: 0; min-height: 0; }
.kind-tabs { display: flex; gap: 4px; }
.kind { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--cj-line); background: var(--cj-paper); font-size: 12px; cursor: pointer; color: var(--cj-ink); font-family: inherit; }
.kind.on { background: var(--cj-ink); border-color: var(--cj-ink); color: #fff; font-weight: 600; }
.mem-list { flex: 1; overflow-y: auto; min-height: 0; }
.mem-item { display: flex; gap: 10px; align-items: center; padding: 8px; border-radius: 6px; cursor: pointer; margin-bottom: 2px; }
.mem-item:hover { background: #f7f3ed; }
.mem-item.on { background: var(--cj-gray-soft); }
.mem-item.dead { opacity: .6; }
.mem-text { display: flex; flex-direction: column; min-width: 0; }
.mem-text b, .mem-text small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.avatar { width: 28px; height: 28px; border-radius: 50%; background: #d9cfc2; color: #5b5045; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; font-size: 12px; }
.avatar.big { width: 44px; height: 44px; font-size: 18px; font-family: var(--cj-serif); }
.mem-page { background: var(--cj-bg); }
.mem-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; align-items: start; }
.detail { padding: 20px 22px; }
.detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.side-cards { display: flex; flex-direction: column; gap: 14px; }
.side-card { padding: 16px 18px; }
.history-row { display: grid; grid-template-columns: 64px 1fr auto; gap: 8px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--cj-line); font-size: 12px; }
.history-text { overflow: hidden; text-overflow: ellipsis; }
.summary-text { line-height: 2; font-size: 15px; white-space: pre-wrap; }
.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
.edit-grid .full { grid-column: 1 / -1; }
.relation-row { display: flex; gap: 6px; margin-bottom: 6px; }
.cj-main.is-mobile { flex-direction: column; position: relative; overflow: hidden; }
.m-mem { flex: 1; min-height: 0; overflow: auto; padding: 12px 12px 96px; }
.m-group { margin-top: 16px; }
.m-group h2 { font-size: 13px; color: var(--cj-sub); margin: 0 0 8px; }
.m-card {
  width: 100%;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border: 0;
  border-bottom: 1px solid var(--cj-line);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
.m-card-text { display: flex; flex-direction: column; min-width: 0; }
.m-card-text small { color: var(--cj-sub); }
.m-fab {
  position: fixed;
  right: 16px;
  bottom: calc(68px + env(safe-area-inset-bottom));
  z-index: 20;
  min-width: 64px;
  min-height: 56px;
  border: 0;
  border-radius: 28px;
  background: var(--cj-accent);
  color: #fff;
  font: inherit;
  font-weight: 700;
  box-shadow: 0 6px 16px rgba(184, 67, 47, 0.35);
}
.m-summary {
  position: absolute;
  inset: 0;
  z-index: 6;
  background: var(--cj-bg);
  overflow: auto;
  padding: 12px 16px 24px;
}
.m-summary-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.m-fab-mask {
  position: absolute;
  inset: 0;
  z-index: 25;
  background: rgba(35, 32, 28, 0.35);
  display: flex;
  align-items: flex-end;
}
.m-fab-sheet {
  width: 100%;
  background: var(--cj-paper);
  border-radius: 16px 16px 0 0;
  padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}
.m-fab-sheet button {
  min-height: 48px;
  border: 0;
  border-bottom: 1px solid var(--cj-line);
  background: transparent;
  font: inherit;
  font-size: 16px;
}
.m-fab-sheet button:last-child { border-bottom: 0; color: var(--cj-sub); }
@media (max-width: 960px) {
  .mem-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .cj-main { flex-direction: column; overflow-y: auto; }
  .mem-side { width: 100%; max-height: 240px; border-right: none; border-bottom: 1px solid var(--cj-line); }
  .edit-grid { grid-template-columns: 1fr; }
  .relation-row { flex-wrap: wrap; }
  .relation-row :deep(.el-input) { flex: 1 1 120px; min-width: 0; width: auto !important; }
}
</style>
