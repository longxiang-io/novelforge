<template>
  <div class="confirm-view">
    <div class="confirm-head">
      <div>
        <div class="cj-muted" style="font-size: 12px">{{ $t('rest.confirm.head', { number: chapter.number, title: chapter.title }) }}</div>
        <div class="cj-serif" style="font-size: 20px; font-weight: 700">{{ $t('rest.confirm.title') }}</div>
      </div>
      <slot name="steps"></slot>
      <div class="cj-spacer"></div>
      <button class="cj-btn sm" :disabled="extracting" @click="extract(false)">{{ $t('rest.confirm.extractAgain') }}</button>
    </div>

    <div v-if="extracting" class="cj-empty">{{ $t('rest.confirm.extracting') }}</div>
    <div v-else-if="extractError" class="cj-error-box" style="max-width: 640px">
      <b>{{ $t('rest.confirm.extractFailed') }}</b>{{ extractError }}
      <div style="margin-top: 10px; display: flex; gap: 8px">
        <button class="cj-btn sm" @click="extract(false)">{{ $t('rest.confirm.retry') }}</button>
        <button class="cj-btn sm" @click="extract(true)">{{ $t('rest.confirm.skipModel') }}</button>
        <button v-if="extractErrorType === 'not_configured'" class="cj-btn sm" @click="$emit('settings')">{{ $t('errors.goFillKey') }}</button>
        <button v-else-if="extractErrorType === 'local_key_missing'" class="cj-btn sm" @click="$emit('settings')">{{ $t('errors.goFill') }}</button>
      </div>
    </div>
    <div v-else class="confirm-body">
      <section class="col">
        <div class="col-head">
          <b>{{ $t('rest.confirm.needYou') }}</b>
          <span class="cj-tag red">{{ $t('rest.confirm.left', { pending: pendingCount, total: manual.length }) }}</span>
          <div class="cj-spacer"></div>
          <span class="cj-muted" style="font-size: 11px">{{ $t('rest.confirm.shortcuts') }}</span>
        </div>
        <div v-if="!manual.length" class="cj-card cj-empty" style="padding: 24px">{{ $t('rest.confirm.noneManual') }}</div>
        <div v-for="change in manual" :key="change.id" class="cj-card change" :class="{ active: change.id === focusId, decided: change.decision !== 'pending' }" @click="focusId = change.id">
          <div class="change-head">
            <span class="cj-tag" :class="kindMeta(change).color">{{ kindMeta(change).label }}<template v-if="change.decision === 'accepted' && change.kind === 'new_foreshadow'"> ✓</template></span>
            <b>{{ targetText(change) }}</b>
            <div class="cj-spacer"></div>
            <span v-if="change.decision === 'accepted'" class="cj-muted" style="font-size: 12px">{{ $t('rest.confirm.accepted') }}<template v-if="change.edited">{{ $t('rest.confirm.acceptedEdited') }}</template><template v-if="change.kind === 'new_foreshadow' && change.payload.planned_chapter">{{ $t('rest.confirm.planned', { chapter: change.payload.planned_chapter }) }}</template></span>
            <span v-else-if="change.decision === 'rejected'" class="cj-muted" style="font-size: 12px">{{ $t('rest.confirm.rejected') }}</span>
            <span v-else-if="change.kind !== 'key_state'" class="cj-muted" style="font-size: 12px">{{ $t('rest.confirm.pending') }}</span>
          </div>
          <div v-if="change.kind === 'key_state' || change.kind === 'resolve_foreshadow'" class="diff">
            <span class="cj-strike">{{ change.old_value || '—' }}</span><span class="cj-arrow">→</span><b class="new">{{ change.new_value }}</b>
          </div>
          <div v-else class="content">{{ change.new_value }}</div>
          <div v-if="change.kind === 'resolve_foreshadow' && change.payload.content" class="cj-muted" style="font-size: 12px">{{ change.payload.content }}</div>
          <div v-if="change.quote" class="cj-quote" style="font-size: 12px">{{ $t('rest.confirm.quote', { text: change.quote }) }}<span v-if="change.paragraph" class="cj-muted">{{ $t('rest.confirm.paragraph', { n: change.paragraph }) }}<a class="link" @click.stop="$emit('locate', change.paragraph)">{{ $t('rest.confirm.locate') }}</a></span></div>
          <div v-if="editingId === change.id" class="edit-row" @click.stop>
            <el-input v-model="editValue" size="small" maxlength="1000" @keyup.enter="saveEdit(change)" />
            <el-input-number v-if="change.kind === 'new_foreshadow'" v-model="editPlanned" size="small" :min="chapter.number + 1" :placeholder="$t('rest.confirm.payoffPh')" controls-position="right" />
            <button class="cj-btn sm pri" @click="saveEdit(change)">{{ $t('rest.confirm.saveAccept') }}</button>
            <button class="cj-btn sm" @click="editingId = 0">{{ $t('rest.confirm.cancel') }}</button>
          </div>
          <div v-else class="change-actions">
            <template v-if="change.decision === 'pending'">
              <button class="cj-btn sm pri" @click.stop="accept(change)">{{ $t('rest.confirm.accept') }}</button>
              <button class="cj-btn sm" @click.stop="startEdit(change)">{{ $t('rest.confirm.edit') }}</button>
              <button class="cj-btn sm" @click.stop="decide(change, 'rejected')">{{ $t('rest.confirm.reject') }}</button>
              <div class="cj-spacer"></div>
              <button class="cj-btn sm ghost" @click.stop="skip(change)">{{ $t('rest.confirm.later') }}</button>
            </template>
            <button v-else class="cj-btn sm ghost" @click.stop="decide(change, 'pending')">{{ $t('rest.confirm.undo') }}</button>
          </div>
        </div>
      </section>

      <section class="col">
        <div class="col-head">
          <b>{{ $t('rest.confirm.autoTitle') }}</b>
          <span class="cj-tag gray">{{ autoList.filter(item => item.decision === 'accepted').length }}</span>
          <span class="cj-muted" style="font-size: 12px">{{ $t('rest.confirm.autoHint') }}</span>
        </div>
        <div class="cj-card auto-list">
          <div v-if="!autoList.length" class="cj-muted" style="padding: 14px">{{ $t('rest.confirm.noAuto') }}</div>
          <div v-for="change in autoList" :key="change.id" class="auto-row" :class="{ off: change.decision === 'rejected' }">
            <b class="who">{{ change.target_name }}</b>
            <span class="field cj-muted">{{ fieldLabel(change.field) }}</span>
            <span class="val"><span class="cj-strike">{{ change.old_value || '—' }}</span> → {{ change.new_value }}</span>
            <button class="cj-btn sm ghost" @click="decide(change, change.decision === 'rejected' ? 'accepted' : 'rejected')">{{ change.decision === 'rejected' ? $t('rest.confirm.restore') : $t('rest.confirm.undo') }}</button>
          </div>
        </div>
        <div class="key-note"><b>{{ $t('rest.confirm.keyNoteLead') }}</b>{{ $t('rest.confirm.keyNoteRest') }}</div>
      </section>
    </div>

    <div class="confirm-foot">
      <span class="cj-muted">{{ $t('rest.confirm.foot', { count: affectedCount, number: chapter.number }) }}</span>
      <div class="cj-spacer"></div>
      <button class="cj-btn" @click="$emit('back')">{{ $t('rest.confirm.laterConfirm') }}</button>
      <button class="cj-btn pri" :disabled="pendingCount > 0 || confirming || extracting || !!extractError" @click="confirm">
        {{ confirming ? $t('rest.confirm.saving') : (pendingCount ? $t('rest.confirm.saveLeft', { count: pendingCount }) : $t('rest.confirm.save')) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoryLabel, cjApi, fieldLabel, toastError } from '../api.js'

const { t } = useI18n()

const props = defineProps({ chapter: { type: Object, required: true } })
const emit = defineEmits(['back', 'confirmed', 'refresh', 'locate', 'settings'])

const extracting = ref(false)
const extractError = ref('')
const extractErrorType = ref('')
const confirming = ref(false)
const focusId = ref(0)
const editingId = ref(0)
const editValue = ref('')
const editPlanned = ref(null)

const KIND_COLOR = {
  key_state: 'red',
  new_setting: 'amb',
  new_character: 'amb',
  new_foreshadow: 'green',
  resolve_foreshadow: 'green'
}
const KIND_KEY = {
  key_state: 'keyState',
  new_setting: 'newSetting',
  new_character: 'newCharacter',
  new_foreshadow: 'newForeshadow',
  resolve_foreshadow: 'resolve'
}
const kindMeta = (change) => {
  const key = KIND_KEY[change.kind]
  return key ? { label: t(`rest.confirm.kinds.${key}`), color: KIND_COLOR[change.kind] } : { label: change.kind, color: 'gray' }
}

const changes = computed(() => props.chapter.changes || [])
const manual = computed(() => changes.value.filter(item => item.kind !== 'state'))
const autoList = computed(() => changes.value.filter(item => item.kind === 'state'))
const pendingCount = computed(() => manual.value.filter(item => item.decision === 'pending').length)
const affectedCount = computed(() => new Set(changes.value.filter(item => item.decision === 'accepted').map(item => item.kind === 'new_foreshadow' ? `f${item.id}` : `${item.kind.includes('foreshadow') ? 'f' : 'c'}:${item.target_name || item.new_value}`)).size)

const targetText = (change) => {
  if (change.kind === 'key_state') return `${change.target_name} · ${fieldLabel(change.field)}`
  if (change.kind === 'new_setting') return `${change.target_name}${change.field ? ` · ${categoryLabel(change.field)}` : ''}`
  if (change.kind === 'new_character') return change.target_name
  if (change.kind === 'resolve_foreshadow') return change.target_name
  return t('rest.confirm.newForeshadowTarget')
}

const extract = async (skipModel) => {
  extracting.value = true
  extractError.value = ''
  extractErrorType.value = ''
  try {
    await cjApi(`/chapters/${props.chapter.id}/extract`, { method: 'POST', body: { skip_model: skipModel } })
    emit('refresh')
  } catch (err) {
    extractError.value = err.message
    extractErrorType.value = err.data?.error_type || ''
  } finally {
    extracting.value = false
  }
}

const decide = async (change, decision, newValue, planned) => {
  try {
    const body = { decision }
    if (newValue !== undefined) body.new_value = newValue
    if (planned !== undefined) body.planned_chapter = planned
    await cjApi(`/changes/${change.id}`, { method: 'PUT', body })
    emit('refresh')
    if (decision !== 'pending') nextFocus(change.id)
  } catch (err) {
    toastError(err)
  }
}

// 死亡、离场接受前再问一次
const accept = async (change) => {
  if (change.kind === 'key_state' && ['alive', 'present'].includes(change.field)) {
    try {
      await ElMessageBox.confirm(t('rest.confirm.acceptPrompt', { name: change.target_name, field: fieldLabel(change.field), value: change.new_value }), t('rest.confirm.acceptTitle'), { confirmButtonText: t('rest.confirm.acceptConfirm'), cancelButtonText: t('rest.confirm.acceptCancel'), type: 'warning' })
    } catch {
      return
    }
  }
  decide(change, 'accepted')
}

const startEdit = (change) => {
  editingId.value = change.id
  editValue.value = change.new_value
  editPlanned.value = change.payload?.planned_chapter || null
}

const saveEdit = (change) => {
  if (!editValue.value.trim()) return ElMessage.warning(t('rest.confirm.emptyValue'))
  editingId.value = 0
  decide(change, 'accepted', editValue.value.trim(), change.kind === 'new_foreshadow' ? editPlanned.value : undefined)
}

const nextFocus = (currentId) => {
  const pending = manual.value.filter(item => item.decision === 'pending' && item.id !== currentId)
  focusId.value = pending[0]?.id || 0
}

const skip = (change) => {
  const pending = manual.value.filter(item => item.decision === 'pending')
  const index = pending.findIndex(item => item.id === change.id)
  focusId.value = pending[(index + 1) % pending.length]?.id || 0
}

const onKey = (event) => {
  if (editingId.value || ['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return
  const change = manual.value.find(item => item.id === focusId.value && item.decision === 'pending')
  if (!change) return
  const key = event.key.toLowerCase()
  if (key === 'a') accept(change)
  else if (key === 'r') decide(change, 'rejected')
  else if (key === 'e') { event.preventDefault(); startEdit(change) }
}

const confirm = async () => {
  confirming.value = true
  try {
    const json = await cjApi(`/chapters/${props.chapter.id}/confirm`, { method: 'POST' })
    if (json.data.summary_error) ElMessage.warning(t('rest.confirm.summaryFailed', { error: json.data.summary_error }))
    else ElMessage.success(t('rest.confirm.saved'))
    emit('confirmed', json.data)
  } catch (err) {
    toastError(err)
  } finally {
    confirming.value = false
  }
}

watch(() => props.chapter.changes, () => {
  if (!manual.value.some(item => item.id === focusId.value && item.decision === 'pending')) nextFocus(0)
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (!changes.value.length) extract(false)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.confirm-view { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.confirm-head { display: flex; align-items: center; gap: 24px; padding: 18px 28px 12px; flex-wrap: wrap; }
.confirm-body { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 8px 28px 20px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 10px; }
.col-head { display: flex; align-items: center; gap: 8px; }
.change { padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 8px; }
.change.active { border-color: var(--cj-accent); box-shadow: 0 0 0 1px var(--cj-accent); }
.change.decided { background: #fdfbf7; }
.change-head { display: flex; align-items: center; gap: 8px; }
.diff { display: flex; align-items: center; gap: 12px; font-family: var(--cj-serif); font-size: 16px; }
.diff .new { color: var(--cj-red); }
.content { line-height: 1.7; }
.change-actions, .edit-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.edit-row :deep(.el-input) { flex: 1; min-width: 160px; }
.link { color: var(--cj-accent); cursor: pointer; }
.auto-list { padding: 4px 14px; }
.auto-row { display: grid; grid-template-columns: 70px 90px 1fr auto; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--cj-line); font-size: 12px; }
.auto-row:last-child { border-bottom: none; }
.auto-row.off { opacity: .5; }
.key-note { background: var(--cj-red-soft); border: 1px solid #f0c4bd; color: var(--cj-red); border-radius: 8px; padding: 10px 12px; font-size: 12px; }
.confirm-foot { display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-top: 1px solid var(--cj-line); background: var(--cj-bg); flex-wrap: wrap; }
@media (max-width: 960px) {
  .confirm-body { grid-template-columns: 1fr; padding: 8px 16px 16px; }
  .confirm-head, .confirm-foot { padding-left: 16px; padding-right: 16px; }
}
</style>
