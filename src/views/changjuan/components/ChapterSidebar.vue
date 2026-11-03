<template>
  <aside class="cj-side">
    <div class="side-head">
      <b>{{ $t('rest.sidebar.title') }}</b>
      <button class="cj-btn sm" :disabled="creating" @click="$emit('create')">{{ $t('rest.sidebar.newChapter') }}</button>
    </div>
    <div class="side-list">
      <template v-for="group in groups" :key="group.key">
        <h4>{{ group.title }}</h4>
        <div v-for="chapter in group.chapters" :key="chapter.id" class="ch" :class="{ on: chapter.id === activeId }"
          @click="$emit('select', chapter.id)">
          <span class="n">{{ pad3(chapter.number) }}</span>
          <span class="t">{{ chapter.title }}</span>
          <span class="cj-dot" :class="chapter.dot"></span>
        </div>
      </template>
      <div v-if="!chapters.length" class="cj-muted" style="padding: 12px 8px; line-height: 1.8">{{ $t('rest.sidebar.empty') }}</div>
    </div>
    <div class="legend">
      <div><span class="cj-dot ok"></span> {{ $t('rest.sidebar.confirmed') }}</div>
      <div><span class="cj-dot red"></span> {{ $t('rest.sidebar.must') }}</div>
      <div><span class="cj-dot amber"></span> {{ $t('rest.sidebar.generated') }}</div>
      <div><span class="cj-dot none"></span> {{ $t('rest.sidebar.outlineOnly') }}</div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { pad3 } from '../api.js'

const { t } = useI18n()

const props = defineProps({
  chapters: { type: Array, default: () => [] },
  volumes: { type: Array, default: () => [] },
  activeId: { type: Number, default: 0 },
  creating: { type: Boolean, default: false }
})
defineEmits(['select', 'create'])

const groups = computed(() => {
  const list = props.volumes.map(volume => ({
    key: volume.id,
    title: volume.goal ? `${volume.title} · ${volume.goal}` : volume.title,
    chapters: props.chapters.filter(item => item.volume_id === volume.id)
  }))
  const loose = props.chapters.filter(item => !props.volumes.some(volume => volume.id === item.volume_id))
  if (loose.length) list.push({ key: 'none', title: t('rest.sidebar.unvolumed'), chapters: loose })
  return list.filter(group => group.chapters.length || list.length === 1)
})
</script>

<style scoped>
.cj-side { width: 236px; background: var(--cj-paper); border-right: 1px solid var(--cj-line); padding: 14px 10px; display: flex; flex-direction: column; flex-shrink: 0; min-height: 0; }
.side-head { display: flex; justify-content: space-between; align-items: center; padding: 0 8px 8px; font-size: 14px; }
.side-list { flex: 1; overflow-y: auto; min-height: 0; }
h4 { font-size: 12px; color: var(--cj-sub); font-weight: 500; padding: 6px 8px; margin: 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px; margin-bottom: 2px; cursor: pointer; }
.ch:hover { background: #f7f3ed; }
.ch .n { color: var(--cj-sub); width: 28px; font-variant-numeric: tabular-nums; }
.ch .t { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch.on { background: var(--cj-gray-soft); font-weight: 600; }
.legend { margin-top: 12px; padding: 10px 8px 0; border-top: 1px solid var(--cj-line); font-size: 11px; color: var(--cj-sub); line-height: 2; }
.legend .cj-dot { margin-right: 4px; vertical-align: middle; }
@media (max-width: 768px) {
  .cj-side { width: 100%; max-height: 180px; border-right: none; border-bottom: 1px solid var(--cj-line); }
  .legend { display: none; }
}
</style>
