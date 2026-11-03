<template>
  <div class="context-panel">
    <div v-if="loading" class="cj-empty">{{ $t('rest.context.loading') }}</div>
    <div v-else-if="error" class="cj-error-box">{{ error }}</div>
    <template v-else-if="context">
      <div class="cj-muted" style="font-size: 12px">{{ $t('rest.context.intro') }}</div>
      <div v-for="warning in context.warnings" :key="warning.type + warning.name" class="cj-warn-box">
        <b>{{ $t('rest.context.warnTitle') }}</b>
        <div style="margin-top: 4px">{{ warning.message }}</div>
        <div style="margin-top: 8px; display: flex; gap: 6px">
          <button v-if="warning.type === 'not_listed'" class="cj-btn sm" @click="$emit('add-character', warning.name)">{{ $t('rest.context.addCharacter') }}</button>
          <button v-if="warning.type === 'no_card'" class="cj-btn sm" @click="$emit('create-card', warning.name)">{{ $t('rest.context.createCard') }}</button>
        </div>
      </div>
      <div class="block">
        <div class="cj-section-title">{{ $t('rest.context.characters', { count: context.characters.length }) }}</div>
        <div class="pills"><span v-for="item in context.characters" :key="item.id" class="cj-tag gray pill">{{ item.name }}</span><span v-if="!context.characters.length" class="cj-muted">{{ $t('rest.context.none') }}</span></div>
      </div>
      <div class="block">
        <div class="cj-section-title">{{ $t('rest.context.settings', { count: context.settings.length }) }}</div>
        <div class="pills"><span v-for="item in context.settings" :key="item.id" class="cj-tag gray pill">{{ item.name }}</span><span v-if="!context.settings.length" class="cj-muted">{{ $t('rest.context.settingsEmpty') }}</span></div>
      </div>
      <div class="block">
        <div class="cj-section-title">{{ $t('rest.context.foreshadows', { count: context.foreshadows.length }) }}</div>
        <div class="pills"><span v-for="item in context.foreshadows" :key="item.id" class="cj-tag acc pill">{{ item.code }} {{ item.content }}</span><span v-if="!context.foreshadows.length" class="cj-muted">{{ $t('rest.context.none') }}</span></div>
      </div>
      <div class="block">
        <div class="cj-section-title">{{ $t('rest.context.summaries') }}</div>
        <div class="pills"><span v-for="item in context.summaries" :key="item.number" class="cj-tag gray pill">{{ $t('rest.context.chapter', { number: item.number }) }}</span><span v-if="!context.summaries.length" class="cj-muted">{{ $t('rest.context.summariesEmpty') }}</span></div>
      </div>
      <div class="block">
        <div class="cj-section-title">{{ $t('rest.context.volumeGoal') }}</div>
        <div class="cj-serif">{{ context.volume?.goal || $t('rest.context.goalEmpty') }}</div>
      </div>
      <div v-if="chapter.injected?.prompt_tokens" class="cj-muted" style="font-size: 12px; border-top: 1px solid var(--cj-line); padding-top: 10px">
        {{ $t('rest.context.lastGen', { model: chapter.injected.model, count: numberText(chapter.injected.prompt_tokens) }) }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { cjApi, numberText } from '../api.js'

const props = defineProps({
  chapter: { type: Object, required: true },
  // 外部变更（如保存细纲）后递增，触发重新加载
  version: { type: Number, default: 0 },
  live: { type: Object, default: null }
})
defineEmits(['add-character', 'create-card'])

const context = ref(null)
const loading = ref(false)
const error = ref('')

const load = async () => {
  if (props.live) {
    context.value = props.live
    return
  }
  loading.value = true
  error.value = ''
  try {
    const json = await cjApi(`/chapters/${props.chapter.id}/context`)
    context.value = json.data
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(() => [props.chapter.id, props.version, props.live], load, { immediate: true })
</script>

<style scoped>
.context-panel { display: flex; flex-direction: column; gap: 14px; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pill { font-weight: 500; white-space: normal; line-height: 1.5; }
</style>
