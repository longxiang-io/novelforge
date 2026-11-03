<template>
  <div class="issue-panel">
    <div v-if="!chapter.check_run" class="cj-empty">
      {{ $t('rest.issues.never1') }}<br>{{ $t('rest.issues.never2') }}<br>{{ $t('rest.issues.never3') }}
    </div>
    <template v-else>
      <div class="cj-muted meta">
        {{ $t('rest.issues.checked', { time: checkedTime }) }}
      </div>
      <div v-if="chapter.check_dirty" class="cj-warn-box" style="font-size: 12px">{{ $t('rest.issues.dirty') }}</div>
      <div v-if="!openIssues.length" class="cj-empty" style="padding: 24px 8px">{{ $t('rest.issues.clean') }}</div>
      <template v-for="group in groups" :key="group.key">
        <div class="group-title" :class="group.key">{{ group.label }} · {{ group.items.length }}</div>
        <div v-for="issue in group.items" :key="issue.id" class="cj-card issue" :class="group.key">
          <div class="issue-head">
            <b>[{{ issue.seq }}] {{ issue.title }}</b>
            <span v-if="issue.paragraph" class="cj-muted">{{ $t('rest.issues.paragraph', { n: issue.paragraph }) }}</span>
          </div>
          <div v-if="issue.quote" class="cj-quote">{{ $t('rest.issues.quote', { text: issue.quote }) }}</div>
          <div v-if="issue.basis" class="cj-muted" style="font-size: 12px">{{ issue.basis }}</div>
          <div class="issue-actions">
            <button v-if="issue.paragraph" class="cj-btn sm" @click="$emit('locate', issue)">{{ $t('rest.issues.locate') }}</button>
            <button v-if="issue.card_name" class="cj-btn sm" @click="$emit('open-card', issue.card_name)">{{ $t('rest.issues.viewCard') }}</button>
            <div class="cj-spacer"></div>
            <button class="cj-btn sm ghost" @click="openFp(issue)">{{ $t('rest.issues.mark') }}</button>
          </div>
        </div>
      </template>
      <div v-if="fpIssues.length" class="fp-fold">
        <button class="cj-btn ghost sm" @click="showFp = !showFp">{{ showFp ? $t('rest.issues.fpOpen', { count: fpIssues.length }) : $t('rest.issues.fpFolded', { count: fpIssues.length }) }}</button>
        <template v-if="showFp">
          <div v-for="issue in fpIssues" :key="issue.id" class="cj-card issue fp">
            <div class="issue-head"><span>[{{ issue.seq }}] {{ issue.title }}</span><button class="cj-btn sm ghost" @click="unmark(issue)">{{ $t('rest.issues.unmark') }}</button></div>
            <div class="cj-muted" style="font-size: 12px">{{ reasonLabel(issue.fp_reason) }}<template v-if="issue.fp_note">{{ $t('rest.issues.noteSep', { note: issue.fp_note }) }}</template></div>
          </div>
        </template>
      </div>
    </template>

    <el-dialog v-model="fpVisible" :title="$t('rest.issues.markTitle')" width="440px" class="cj-dialog" append-to-body>
      <template v-if="fpTarget">
        <div style="font-weight: 600">[{{ fpTarget.seq }}] {{ fpTarget.title }} · {{ severityLabel(fpTarget.severity) }}</div>
        <div v-if="fpTarget.quote" class="cj-quote">{{ $t('rest.issues.quote', { text: fpTarget.quote }) }}</div>
        <div class="cj-form-row" style="margin-top: 14px">
          <label>{{ $t('rest.issues.reasonLabel') }}</label>
          <div class="reasons">
            <button v-for="reason in REASONS" :key="reason.code" class="cj-btn sm" :class="{ pri: fpForm.reason === reason.code }" @click="fpForm.reason = fpForm.reason === reason.code ? '' : reason.code">{{ reasonLabel(reason.code) }}</button>
          </div>
        </div>
        <div class="cj-form-row">
          <el-input v-model="fpForm.note" type="textarea" :rows="2" maxlength="300" :placeholder="$t('rest.issues.notePh')" />
        </div>
        <el-checkbox v-model="fpForm.suppress">{{ $t('rest.issues.suppress') }}</el-checkbox>
      </template>
      <template #footer>
        <div class="cj-dialog-footer">
          <button class="cj-btn" @click="fpVisible = false">{{ $t('rest.issues.cancel') }}</button>
          <button class="cj-btn pri" :disabled="fpSaving" @click="submitFp">{{ $t('rest.issues.submit') }}</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { cjApi, severityLabel, timeText, toastError } from '../api.js'

const { t } = useI18n()

const props = defineProps({ chapter: { type: Object, required: true } })
const emit = defineEmits(['locate', 'open-card', 'changed'])

// Codes stay Chinese: the API only accepts these exact reason strings.
const REASONS = [
  { code: '故意这样写', key: 'intentional' },
  { code: '检查理解错了原文', key: 'misread' },
  { code: '记忆库信息过时', key: 'stale' },
  { code: '其他', key: 'other' }
]
const reasonLabel = (code) => {
  const found = REASONS.find(item => item.code === code)
  return found ? t(`rest.issues.reasons.${found.key}`) : (code || t('rest.issues.noReason'))
}
const showFp = ref(false)
const fpVisible = ref(false)
const fpTarget = ref(null)
const fpSaving = ref(false)
const fpForm = reactive({ reason: '', note: '', suppress: false })

const checkedTime = computed(() => timeText(props.chapter.checked_at).slice(6) || timeText(props.chapter.checked_at))
const openIssues = computed(() => (props.chapter.issues || []).filter(item => !item.false_positive))
const fpIssues = computed(() => (props.chapter.issues || []).filter(item => item.false_positive))
const groups = computed(() => ['must', 'should', 'hint']
  .map(key => ({ key, label: severityLabel(key), items: openIssues.value.filter(item => item.severity === key) }))
  .filter(group => group.items.length))

const openFp = (issue) => {
  fpTarget.value = issue
  Object.assign(fpForm, { reason: '', note: '', suppress: false })
  fpVisible.value = true
}

const submitFp = async () => {
  fpSaving.value = true
  try {
    await cjApi(`/issues/${fpTarget.value.id}`, { method: 'PUT', body: { false_positive: true, ...fpForm } })
    ElMessage.success(t('rest.issues.marked'))
    fpVisible.value = false
    emit('changed')
  } catch (err) {
    toastError(err)
  } finally {
    fpSaving.value = false
  }
}

const unmark = async (issue) => {
  try {
    await cjApi(`/issues/${issue.id}`, { method: 'PUT', body: { false_positive: false } })
    emit('changed')
  } catch (err) {
    toastError(err)
  }
}
</script>

<style scoped>
.issue-panel { display: flex; flex-direction: column; gap: 12px; }
.meta { font-size: 12px; }
.group-title { font-size: 12px; font-weight: 600; }
.group-title.must { color: var(--cj-red); }
.group-title.should { color: var(--cj-amber); }
.group-title.hint { color: var(--cj-sub); }
.issue { padding: 12px; border-left: 3px solid #cfc7bb; }
.issue.must { border-left-color: var(--cj-red); }
.issue.should { border-left-color: var(--cj-amber); }
.issue.fp { opacity: .75; margin-top: 8px; }
.issue-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.issue-actions { display: flex; gap: 6px; margin-top: 10px; align-items: center; }
.fp-fold { text-align: center; }
.reasons { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
