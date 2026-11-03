<template>
  <div class="cj-main">
    <aside class="ver-side">
      <b>{{ $t('rest.versions.title') }}</b>
      <div class="cj-muted" style="font-size: 11px; margin: 4px 0 10px">{{ $t('rest.versions.subtitle') }}</div>
      <div v-for="item in list" :key="item.id" class="ver" :class="{ on: item.id === activeId, reverted: item.reverted }" @click="activeId = item.id">
        <b>{{ item.label }}</b>
        <small class="cj-muted">{{ timeText(item.created_at) }} · {{ item.reverted ? $t('rest.versions.reverted') : (item.stats?.source === 'assist' ? $t('rest.versions.assistCount', { count: item.card_count }) : $t('rest.versions.cardCount', { count: item.card_count })) }}</small>
      </div>
      <div v-if="!loading && !list.length" class="cj-muted" style="line-height: 1.8">{{ $t('rest.versions.empty') }}</div>
    </aside>

    <div class="cj-page">
      <div v-if="error" class="cj-error-box">{{ error }}</div>
      <div v-else-if="!detail" class="cj-empty">{{ loading ? $t('rest.versions.loading') : $t('rest.versions.pick') }}</div>
      <template v-else>
        <div class="cj-page-head">
          <div>
            <div class="cj-muted" style="font-size: 12px">{{ timeText(detail.created_at) }}<template v-if="detail.reverted">{{ $t('rest.versions.revertedAt', { time: timeText(detail.reverted_at) }) }}</template></div>
            <h1>{{ detail.label }} · {{ assistVersion ? $t('rest.versions.places', { count: detail.groups.length }) : $t('rest.versions.cards', { count: detail.groups.length }) }}</h1>
          </div>
          <div class="cj-spacer"></div>
          <button v-if="detail.chapter_id" class="cj-btn sm" @click="router.push(`/changjuan/book/${bookId}/write/${detail.chapter_id}`)">{{ $t('rest.versions.viewChapter', { number: detail.chapter_number }) }}</button>
          <button v-if="!detail.reverted" class="cj-btn pri" @click="confirmVisible = true">{{ assistVersion ? $t('rest.versions.undoEdit') : $t('rest.versions.undoConfirm') }}</button>
        </div>
        <div v-if="!detail.groups.length" class="cj-card" style="padding: 18px; margin-bottom: 16px">{{ $t('rest.versions.noMemory') }}</div>
        <div class="group-grid">
          <div v-for="group in detail.groups" :key="`${group.target_type}-${group.target_id}`" class="cj-card group">
            <div class="group-head">
              <b>{{ group.target_name }}</b>
              <span class="cj-muted" style="font-size: 12px">{{ typeLabel(group.target_type) }}</span>
              <span v-if="group.created" class="cj-tag green">{{ $t('rest.versions.created') }}</span>
              <div class="cj-spacer"></div>
              <button v-if="!detail.reverted && (group.target_type === 'character' || group.target_type === 'setting')" class="cj-btn sm ghost" @click="restoreCard(group)">{{ $t('rest.versions.restoreCard') }}</button>
            </div>
            <div v-for="(item, index) in group.items" :key="index" class="change-row">
              <span class="cj-muted">{{ item.field_label }}</span>
              <span>
                <span class="old">{{ item.old || '—' }}</span>
                <span class="new">{{ item.new || '—' }}</span>
                <span v-if="item.edited" class="cj-tag gray" style="margin-left: 4px">{{ $t('rest.versions.handEdited') }}</span>
              </span>
            </div>
          </div>
        </div>
        <div v-if="confirmVisible" class="cj-card revert-box">
          <b>{{ $t('rest.versions.beforeTitle') }}</b>
          <p v-if="assistVersion">{{ $t('rest.versions.assistBody', { label: detail.label }) }}</p>
          <p v-else>{{ $t('rest.versions.confirmBody', { label: detail.label, count: detail.groups.length, number: detail.chapter_number }) }}</p>
          <p v-if="detail.later_confirmed" class="cj-muted" style="color: var(--cj-red)">{{ $t('rest.versions.later') }}</p>
          <div class="cj-dialog-footer" style="display: flex; justify-content: flex-end; gap: 8px">
            <button class="cj-btn" @click="confirmVisible = false">{{ $t('rest.versions.cancel') }}</button>
            <button class="cj-btn pri" :disabled="!detail.can_revert || reverting" @click="revert">{{ $t('rest.versions.confirmUndo') }}</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cjApi, timeText, toastError } from './api.js'

const { t } = useI18n()
const router = useRouter()
const { reload, bookId } = inject('cj')
const TYPE_KEYS = { character: 'character', setting: 'setting', foreshadow: 'foreshadow' }
const typeLabel = (type) => (TYPE_KEYS[type] ? t(`rest.versions.types.${TYPE_KEYS[type]}`) : '')

const list = ref([])
const activeId = ref(0)
const detail = ref(null)
const loading = ref(true)
const error = ref('')
const confirmVisible = ref(false)
const reverting = ref(false)
const assistVersion = computed(() => detail.value?.stats?.source === 'assist' || detail.value?.chapter_id === 0)

const loadList = async () => {
  loading.value = true
  error.value = ''
  try {
    const json = await cjApi(`/books/${bookId.value}/versions`)
    list.value = json.data
    if (!list.value.some(item => item.id === activeId.value)) activeId.value = list.value[0]?.id || 0
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const loadDetail = async () => {
  detail.value = null
  confirmVisible.value = false
  if (!activeId.value) return
  try {
    const json = await cjApi(`/versions/${activeId.value}`)
    detail.value = json.data
  } catch (err) {
    toastError(err)
  }
}

watch(activeId, loadDetail)

const restoreCard = async (group) => {
  try {
    await ElMessageBox.confirm(t('rest.versions.restorePrompt', { name: group.target_name, number: detail.value.chapter_number }), t('rest.versions.restoreTitle'), { confirmButtonText: t('rest.versions.restore'), cancelButtonText: t('rest.versions.cancel'), type: 'warning' })
  } catch {
    return
  }
  try {
    const json = await cjApi(`/versions/${detail.value.id}/restore-card`, { method: 'POST', body: { card_id: group.target_id } })
    ElMessage.success(json.message)
  } catch (err) {
    toastError(err)
  }
}

const revert = async () => {
  reverting.value = true
  try {
    const json = await cjApi(`/versions/${detail.value.id}/revert`, { method: 'POST' })
    ElMessage.success(json.message)
    await Promise.all([loadList(), reload()])
    await loadDetail()
  } catch (err) {
    toastError(err)
  } finally {
    reverting.value = false
  }
}

onMounted(async () => {
  await loadList()
  loadDetail()
})
</script>

<style scoped>
.cj-main { flex: 1; display: flex; min-height: 0; }
.ver-side { width: 236px; background: var(--cj-paper); border-right: 1px solid var(--cj-line); padding: 14px 10px; overflow-y: auto; flex-shrink: 0; }
.ver { padding: 9px 8px; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; margin-bottom: 4px; }
.ver:hover { background: #f7f3ed; }
.ver.on { background: var(--cj-gray-soft); }
.ver.reverted b { text-decoration: line-through; color: var(--cj-sub); }
.ver small { font-size: 11px; }
.group-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.group { padding: 14px 16px; }
.group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.change-row { display: grid; grid-template-columns: 80px 1fr; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--cj-line); font-size: 13px; }
.change-row:last-child { border-bottom: none; }
.old { background: var(--cj-red-soft); color: var(--cj-red); text-decoration: line-through; padding: 1px 4px; border-radius: 3px; margin-right: 4px; }
.new { background: var(--cj-green-soft); color: var(--cj-green); padding: 1px 4px; border-radius: 3px; }
.revert-box { margin-top: 16px; padding: 16px 18px; border-color: var(--cj-amber); }
.revert-box p { line-height: 1.8; margin: 10px 0; }
@media (max-width: 960px) {
  .group-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .cj-main { flex-direction: column; overflow-y: auto; }
  .ver-side { width: 100%; max-height: 220px; border-right: none; border-bottom: 1px solid var(--cj-line); }
}
</style>
