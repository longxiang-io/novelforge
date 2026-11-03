<template>
  <div class="done-view">
    <div class="done-head">
      <div>
        <div class="cj-muted" style="font-size: 12px">{{ $t('rest.chapter.head', { number: chapter.number, title: chapter.title }) }}</div>
        <div class="cj-serif" style="font-size: 20px; font-weight: 700">{{ $t('rest.chapter.confirmed') }}</div>
      </div>
      <slot name="steps"></slot>
      <div class="cj-spacer"></div>
      <button class="cj-btn sm" @click="$emit('read')">{{ $t('rest.chapter.viewText') }}</button>
    </div>
    <div class="done-body">
      <div class="cj-card done-card">
        <div class="done-title">
          <span class="check">✓</span>
          <div>
            <b style="font-size: 15px">{{ $t('rest.chapter.savedTitle') }}</b>
            <div class="cj-muted" style="font-size: 12px">{{ timeText(chapter.version?.created_at).slice(6) }} · {{ $t('rest.chapter.versionLabel', { label: chapter.version?.label || $t('rest.chapter.versionFallback', { number: chapter.number }) }) }}</div>
          </div>
        </div>
        <div class="line">
          {{ $t('rest.chapter.cards', { count: groups.length }) }}
          <span v-for="group in groups" :key="group.target_type + group.target_id" class="cj-tag" :class="group.target_type === 'foreshadow' && group.created ? 'red' : 'gray'">
            {{ group.target_name }}<template v-if="group.target_type === 'foreshadow' && group.created">{{ $t('rest.chapter.newForeshadow') }}</template>
          </span>
          <span v-if="!groups.length" class="cj-muted">{{ $t('rest.chapter.none') }}</span>
        </div>
        <div class="line">{{ $t('rest.chapter.decisions', { accepted: stats.accepted || 0, edited: stats.edited || 0, rejected: stats.rejected || 0 }) }}</div>
        <div class="line">
          <template v-if="chapter.summary">{{ $t('rest.chapter.summaryReady', { number: chapter.number }) }}</template>
          <template v-else>
            <span style="color: var(--cj-red)">{{ $t('rest.chapter.summaryMissing') }}</span>
            <button class="cj-btn sm" style="margin-left: 8px" :disabled="summarizing" @click="regenerateSummary">{{ summarizing ? $t('rest.chapter.generating') : $t('rest.chapter.regenerate') }}</button>
          </template>
        </div>
        <div class="line">
          {{ $t('rest.chapter.totalBefore') }}<b>{{ $t('rest.chapter.totalTokens', { count: numberText(chapter.cost.tokens) }) }}</b>
          <span class="cj-muted">{{ $t('rest.chapter.totalParts', { parts: costParts }) }}</span>
        </div>
        <div class="done-actions">
          <button class="cj-btn pri" @click="$emit('next')">{{ $t('rest.chapter.writeNext', { number: chapter.number + 1 }) }}</button>
          <button class="cj-btn" :disabled="exporting" @click="doExport">{{ $t('rest.chapter.exportTxt') }}</button>
          <div class="cj-spacer"></div>
          <button class="cj-btn ghost" :disabled="!canRevert || reverting" :title="canRevert ? '' : $t('rest.chapter.cannotRevert')" @click="revert">{{ $t('rest.chapter.undo') }}</button>
        </div>
      </div>

      <div class="cj-card export-card">
        <b style="font-size: 15px">{{ $t('rest.chapter.exportTxt') }}</b>
        <div class="cj-section-title cj-muted" style="margin-top: 14px">{{ $t('rest.chapter.range') }}</div>
        <div class="range">
          <el-input-number v-model="exportFrom" :min="1" controls-position="right" size="small" />
          <span>{{ $t('rest.chapter.to') }}</span>
          <el-input-number v-model="exportTo" :min="exportFrom" controls-position="right" size="small" />
          <span class="cj-muted" style="font-size: 12px">{{ $t('rest.chapter.confirmedOnly') }}</span>
        </div>
        <div class="cj-section-title cj-muted" style="margin-top: 14px">{{ $t('rest.chapter.format') }}</div>
        <div class="formats">
          <div>{{ $t('rest.chapter.formatTitle', { number: chapter.number, title: chapter.title }) }}</div>
          <div>{{ $t('rest.chapter.formatBody') }}</div>
          <el-checkbox v-model="merge" :disabled="exportFrom === exportTo">{{ $t('rest.chapter.merge') }}</el-checkbox>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 16px">
          <button class="cj-btn pri" :disabled="exporting" @click="doExport">{{ exporting ? $t('rest.chapter.exporting') : $t('rest.chapter.export') }}</button>
        </div>
      </div>

      <div class="undo-note">
        <b>{{ $t('rest.chapter.undoTitle') }}</b>{{ $t('rest.chapter.undoBody', { count: groups.length }) }}
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cjApi, cjDownload, numberText, promptModelSetup, taskLabel, timeText, toastError } from '../api.js'

const { t } = useI18n()
const router = useRouter()
const props = defineProps({
  chapter: { type: Object, required: true },
  bookId: { type: Number, required: true }
})
const emit = defineEmits(['next', 'read', 'refresh'])

const detail = ref(null)
const exportFrom = ref(1)
const exportTo = ref(1)
const merge = ref(false)
const exporting = ref(false)
const reverting = ref(false)
const summarizing = ref(false)

const groups = computed(() => detail.value?.groups || [])
const stats = computed(() => detail.value?.stats || props.chapter.version?.stats || {})
const canRevert = computed(() => !!detail.value?.can_revert)
const costParts = computed(() => (props.chapter.cost.by_task || [])
  .map(item => t('rest.chapter.costPart', {
    task: taskLabel(item.task) || item.task,
    tokens: numberText(Number(item.prompt_tokens || 0) + Number(item.completion_tokens || 0)),
    extra: item.calls > 1 ? t('rest.chapter.costTimes', { count: item.calls }) : ''
  }))
  .join(t('rest.chapter.costSep')) || t('rest.chapter.noCalls'))

const load = async () => {
  exportFrom.value = props.chapter.number
  exportTo.value = props.chapter.number
  if (!props.chapter.version?.id) return
  try {
    const json = await cjApi(`/versions/${props.chapter.version.id}`)
    detail.value = json.data
  } catch (err) {
    toastError(err)
  }
}
watch(() => props.chapter.version?.id, load, { immediate: true })

const doExport = async () => {
  exporting.value = true
  try {
    const name = await cjDownload(`/books/${props.bookId}/export-txt?from=${exportFrom.value}&to=${exportTo.value}&merge=${merge.value ? 1 : 0}`, 'chapter.txt')
    ElMessage.success(t('rest.chapter.exported', { name }))
  } catch (err) {
    toastError(err)
  } finally {
    exporting.value = false
  }
}

const revert = async () => {
  try {
    await ElMessageBox.confirm(t('rest.chapter.revertPrompt', { label: detail.value?.label, count: groups.value.length, number: props.chapter.number }), t('rest.chapter.revertTitle'), { confirmButtonText: t('rest.chapter.revertConfirm'), cancelButtonText: t('rest.chapter.cancel'), type: 'warning' })
  } catch {
    return
  }
  reverting.value = true
  try {
    const json = await cjApi(`/versions/${props.chapter.version.id}/revert`, { method: 'POST' })
    ElMessage.success(json.message)
    emit('refresh')
  } catch (err) {
    toastError(err)
  } finally {
    reverting.value = false
  }
}

const regenerateSummary = async () => {
  summarizing.value = true
  try {
    await cjApi(`/chapters/${props.chapter.id}/summary`, { method: 'POST' })
    ElMessage.success(t('rest.chapter.summaryDone'))
    emit('refresh')
  } catch (err) {
    if (!(await promptModelSetup(err, () => router.push(`/changjuan/book/${props.bookId}/settings`)))) toastError(err)
  } finally {
    summarizing.value = false
  }
}
</script>

<style scoped>
.done-view { flex: 1; min-width: 0; overflow-y: auto; }
.done-head { display: flex; align-items: center; gap: 24px; padding: 18px 28px 12px; flex-wrap: wrap; }
.done-body { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; padding: 4px 28px 28px; }
.done-card, .export-card { padding: 20px; }
.done-title { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.check { width: 36px; height: 36px; border-radius: 50%; background: var(--cj-green-soft); color: var(--cj-green); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; }
.line { margin: 10px 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.done-actions { display: flex; gap: 8px; margin-top: 22px; }
.range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.range :deep(.el-input-number) { width: 100px; }
.formats { display: flex; flex-direction: column; gap: 8px; }
.undo-note { grid-column: 1 / -1; background: var(--cj-amber-soft); border: 1px solid #f1dcae; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #6b4a14; }
@media (max-width: 960px) {
  .done-body { grid-template-columns: 1fr; padding: 4px 16px 16px; }
  .done-head { padding-left: 16px; padding-right: 16px; }
}
</style>
