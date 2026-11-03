<template>
  <div class="cj-page">
    <div class="cj-page-head"><h1>{{ $t('rest.stats.title') }}</h1></div>
    <div v-if="error" class="cj-error-box">{{ error }}</div>
    <div v-else-if="!data" class="cj-empty">{{ $t('rest.stats.loading') }}</div>
    <template v-else>
      <div class="kpi-grid">
        <div class="cj-card kpi"><span class="cj-muted">{{ $t('rest.stats.missRate') }}</span><b>{{ lastRun ? percent(1 - lastRun.caught / Math.max(1, lastRun.total)) : '—' }}</b><small class="cj-muted">{{ lastRun ? $t('rest.stats.missLatest') : $t('rest.stats.missNone') }}</small></div>
        <div class="cj-card kpi"><span class="cj-muted">{{ $t('rest.stats.falseRate') }}</span><b>{{ percent(data.false_positive_rate) }}</b><small class="cj-muted">{{ $t('rest.stats.falseOf', { count: data.issue_total }) }}</small></div>
        <div class="cj-card kpi"><span class="cj-muted">{{ $t('rest.stats.editRate') }}</span><b>{{ percent(data.edit_ratio) }}</b><small class="cj-muted">{{ $t('rest.stats.editHint') }}</small></div>
        <div class="cj-card kpi"><span class="cj-muted">{{ $t('rest.stats.confirmedWords') }}</span><b>{{ numberText(data.confirmed_words) }}</b><small class="cj-muted">{{ $t('rest.stats.confirmedChapters', { count: data.per_chapter.length }) }}</small></div>
        <div class="cj-card kpi"><span class="cj-muted">{{ $t('rest.stats.tokens') }}</span><b>{{ numberText(data.total_tokens) }}</b><small class="cj-muted">{{ $t('rest.stats.tokensHint') }}</small></div>
      </div>
      <div class="two-col">
        <div class="cj-card panel">
          <div class="panel-head"><b>{{ $t('rest.stats.usage') }}</b><div class="cj-spacer"></div><span class="cj-muted" style="font-size: 12px">{{ anomalyText }}</span></div>
          <div v-if="!data.per_chapter.length" class="cj-empty">{{ $t('rest.stats.noChapters') }}</div>
          <div v-else class="chart">
            <el-tooltip v-for="item in data.per_chapter" :key="item.id" placement="top" popper-class="cj-popper">
              <template #content>
                <div>{{ $t('rest.stats.chapterLine', { number: item.number, title: item.title }) }}</div>
                <div v-for="task in TASK_ORDER" :key="task"><template v-if="item.by_task[task]">{{ $t('rest.stats.taskLine', { task: taskLabel(task), tokens: numberText(item.by_task[task].tokens), calls: item.by_task[task].calls }) }}</template></div>
                <div>{{ $t('rest.stats.totalLine', { tokens: numberText(item.tokens) }) }}</div>
              </template>
              <div class="bar-col">
                <div class="bar" :class="{ dark: isAnomaly(item) }" :style="{ height: `${Math.max(2, (item.tokens / maxTokens) * 100)}%` }"></div>
                <span>{{ item.number }}</span>
              </div>
            </el-tooltip>
          </div>
          <div class="task-totals cj-muted">
            <span v-for="task in TASK_ORDER" :key="task">{{ $t('rest.stats.taskTotal', { task: taskLabel(task), tokens: numberText(data.totals[task]?.tokens || 0) }) }}</span>
          </div>
        </div>
        <div class="cj-card panel">
          <div class="panel-head">
            <b>{{ $t('rest.stats.testTitle') }}</b><span class="cj-muted" style="font-size: 12px; margin-left: 8px">{{ $t('rest.stats.testMeta', { chapters: data.testcase_count, errors: data.testcase_errors }) }}</span>
            <div class="cj-spacer"></div>
            <button class="cj-btn sm" @click="openManager">{{ $t('rest.stats.manage') }}</button>
            <button class="cj-btn sm pri" :disabled="running || !data.testcase_count" @click="runTests">{{ running ? $t('rest.stats.running') : $t('rest.stats.run') }}</button>
          </div>
          <div v-if="!data.testcase_count" class="cj-muted" style="padding: 12px 0; line-height: 1.8">
            {{ $t('rest.stats.emptyLead') }}<a class="link" @click="seed">{{ $t('rest.stats.seedLink') }}</a>{{ $t('rest.stats.emptyTail') }}
          </div>
          <table v-if="data.test_runs.length" class="runs">
            <thead><tr><th>{{ $t('rest.stats.colTime') }}</th><th>{{ $t('rest.stats.colVersion') }}</th><th>{{ $t('rest.stats.colCaught') }}</th><th>{{ $t('rest.stats.colMiss') }}</th><th>{{ $t('rest.stats.colFalse') }}</th></tr></thead>
            <tbody>
              <tr v-for="run in data.test_runs" :key="run.id">
                <td>{{ timeText(run.created_at) }}</td><td>{{ run.prompt_version }}</td><td>{{ run.caught }}/{{ run.total }}</td>
                <td><b>{{ percent(1 - run.caught / Math.max(1, run.total)) }}</b></td>
                <td>{{ run.issue_count ? percent(run.false_count / run.issue_count) : '—' }}</td>
              </tr>
            </tbody>
          </table>
          <template v-if="lastRun">
            <div class="cj-section-title" style="margin-top: 16px">{{ $t('rest.stats.missedTitle') }}</div>
            <div v-for="item in missed" :key="item.key" class="cj-muted missed">{{ item.title }} · {{ item.label || item.keyword }}</div>
            <div v-if="!missed.length" class="cj-muted missed">{{ $t('rest.stats.allCaught') }}</div>
          </template>
        </div>
      </div>
    </template>

    <el-dialog v-model="managerVisible" :title="$t('rest.stats.manage')" width="760px" class="cj-dialog" append-to-body>
      <div class="manager">
        <div class="case-list">
          <div v-for="item in cases" :key="item.id" class="case" :class="{ on: editing.id === item.id }" @click="editCase(item)">
            <b>{{ item.title }}</b><small class="cj-muted">{{ $t('rest.stats.buriedCount', { count: item.expected.length }) }}</small>
          </div>
          <button class="cj-btn sm block" @click="editCase(null)">{{ $t('rest.stats.add') }}</button>
          <button class="cj-btn sm ghost block" style="margin-top: 6px" @click="seed">{{ $t('rest.stats.seed') }}</button>
        </div>
        <div class="case-form">
          <div class="cj-form-row"><label>{{ $t('rest.stats.labelTitle') }}</label><el-input v-model="editing.title" maxlength="60" /></div>
          <div class="cj-form-row"><label>{{ $t('rest.stats.labelContext') }}</label><el-input v-model="editing.context" type="textarea" :rows="3" maxlength="10000" /></div>
          <div class="cj-form-row"><label>{{ $t('rest.stats.labelContent') }}</label><el-input v-model="editing.content" type="textarea" :rows="6" maxlength="20000" /></div>
          <div class="cj-form-row">
            <label>{{ $t('rest.stats.labelExpected') }}</label>
            <div v-for="(item, index) in editing.expected" :key="index" class="expected-row">
              <el-input v-model="item.label" :placeholder="$t('rest.stats.notePh')" />
              <el-input v-model="item.keyword" :placeholder="$t('rest.stats.keywordPh')" style="width: 140px" />
              <button class="cj-btn sm ghost" @click="editing.expected.splice(index, 1)">{{ $t('rest.stats.delete') }}</button>
            </div>
            <button class="cj-btn sm" @click="editing.expected.push({ label: '', keyword: '' })">{{ $t('rest.stats.addExpected') }}</button>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="cj-dialog-footer">
          <button v-if="editing.id" class="cj-btn danger" style="margin-right: auto" @click="removeCase">{{ $t('rest.stats.deleteChapter') }}</button>
          <button class="cj-btn" @click="managerVisible = false">{{ $t('rest.stats.close') }}</button>
          <button class="cj-btn pri" @click="saveCase">{{ $t('rest.stats.save') }}</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cjApi, numberText, percent, promptModelSetup, taskLabel, timeText, toastError } from './api.js'

const { t } = useI18n()
const { bookId } = inject('cj')
const router = useRouter()
const TASK_ORDER = ['generate', 'check', 'extract', 'summary', 'assist']

const data = ref(null)
const error = ref('')
const running = ref(false)
const managerVisible = ref(false)
const cases = ref([])
const editing = ref({ expected: [] })

const lastRun = computed(() => data.value?.test_runs[0] || null)
const missed = computed(() => (lastRun.value?.details || []).flatMap(item => item.hits.filter(hit => !hit.caught).map((hit, index) => ({ key: `${item.id}-${index}`, title: item.title, ...hit }))))
const maxTokens = computed(() => Math.max(1, ...(data.value?.per_chapter || []).map(item => item.tokens)))
// 同一章重新生成超过 2 次标深色
const isAnomaly = (item) => item.generate_calls > 2
const anomalyText = computed(() => {
  const list = (data.value?.per_chapter || []).filter(isAnomaly)
  if (!list.length) return t('rest.stats.anomalyNone')
  const items = list.slice(0, 3).map(item => t('rest.stats.anomalyItem', { number: item.number, count: item.generate_calls })).join(t('rest.stats.listSep'))
  return t('rest.stats.anomalySome', { list: items })
})

const load = async () => {
  error.value = ''
  try {
    const json = await cjApi(`/books/${bookId.value}/stats`)
    data.value = json.data
  } catch (err) {
    error.value = err.message
  }
}

const loadCases = async () => {
  const json = await cjApi('/testcases')
  cases.value = json.data.list
}

const blankCase = () => ({ id: 0, title: '', context: '', content: '', expected: [{ label: '', keyword: '' }] })
const editCase = (item) => { editing.value = item ? JSON.parse(JSON.stringify(item)) : blankCase() }

const openManager = async () => {
  try {
    await loadCases()
    editCase(cases.value[0] || null)
    managerVisible.value = true
  } catch (err) {
    toastError(err)
  }
}

const saveCase = async () => {
  try {
    const json = await cjApi('/testcases', { method: 'POST', body: editing.value })
    ElMessage.success(json.message)
    await loadCases()
    if (!editing.value.id) editCase(cases.value[cases.value.length - 1] || null)
    load()
  } catch (err) {
    toastError(err)
  }
}

const removeCase = async () => {
  try {
    await ElMessageBox.confirm(t('rest.stats.deletePrompt', { title: editing.value.title }), t('rest.stats.delete'), { confirmButtonText: t('rest.stats.delete'), cancelButtonText: t('rest.stats.cancel'), type: 'warning' })
  } catch {
    return
  }
  try {
    await cjApi(`/testcases/${editing.value.id}`, { method: 'DELETE' })
    await loadCases()
    editCase(cases.value[0] || null)
    load()
  } catch (err) {
    toastError(err)
  }
}

const seed = async () => {
  try {
    const json = await cjApi('/testcases/seed', { method: 'POST' })
    ElMessage.success(json.message)
    if (managerVisible.value) {
      await loadCases()
      editCase(cases.value[0] || null)
    }
    load()
  } catch (err) {
    toastError(err)
  }
}

const runTests = async () => {
  running.value = true
  try {
    const json = await cjApi('/testcases/run', { method: 'POST' })
    ElMessage.success(json.message)
    load()
  } catch (err) {
    if (!(await promptModelSetup(err, () => router.push(`/changjuan/book/${bookId.value}/settings`)))) toastError(err)
  } finally {
    running.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 16px; }
.kpi { padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.kpi span { font-size: 12px; }
.kpi b { font-size: 24px; }
.kpi small { font-size: 11px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.panel { padding: 16px 18px; }
.panel-head { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.chart { display: flex; align-items: flex-end; gap: 6px; height: 160px; border-bottom: 1px solid var(--cj-line); padding-bottom: 18px; overflow-x: auto; }
.bar-col { flex: 1; min-width: 14px; max-width: 32px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; cursor: default; }
.bar { width: 100%; background: #dcb5a9; border-radius: 3px 3px 0 0; }
.bar.dark { background: var(--cj-accent); }
.bar-col span { position: absolute; bottom: -18px; font-size: 10px; color: var(--cj-sub); }
.task-totals { display: flex; gap: 14px; margin-top: 12px; font-size: 12px; flex-wrap: wrap; }
.runs { width: 100%; border-collapse: collapse; font-size: 12px; }
.runs th { text-align: left; color: var(--cj-sub); font-weight: 500; padding: 6px 4px; border-bottom: 1px solid var(--cj-line); }
.runs td { padding: 9px 4px; border-bottom: 1px solid var(--cj-line); }
.missed { font-size: 12px; margin-top: 6px; }
.link { color: var(--cj-accent); cursor: pointer; }
.manager { display: grid; grid-template-columns: 180px 1fr; gap: 16px; }
.case-list { border-right: 1px solid var(--cj-line); padding-right: 12px; max-height: 480px; overflow-y: auto; }
.case { padding: 8px; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; margin-bottom: 4px; }
.case.on { background: var(--cj-gray-soft); }
.expected-row { display: flex; gap: 6px; margin-bottom: 6px; }
@media (max-width: 960px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .two-col, .manager { grid-template-columns: 1fr; }
}
</style>
