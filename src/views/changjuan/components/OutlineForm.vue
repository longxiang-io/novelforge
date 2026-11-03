<template>
  <div class="outline-form" :class="{ compact }">
    <div class="row">
      <label>{{ $t('rest.outlineForm.title') }}</label>
      <el-input v-model="form.title" maxlength="60" @change="save" />
    </div>
    <div v-for="field in fields" :key="field.key" class="row">
      <label>{{ field.label }}</label>
      <el-input v-model="form[field.key]" type="textarea" :autosize="{ minRows: compact ? 2 : 2, maxRows: 6 }" :placeholder="field.placeholder" @change="save" />
    </div>
    <div class="row">
      <label>{{ $t('rest.outlineForm.cast') }}</label>
      <div class="chips">
        <span v-for="name in form.characters" :key="name" class="chip" :class="{ missing: !hasCard(name) }">
          {{ name }} <b>{{ hasCard(name) ? '✓' : $t('rest.outlineForm.noCardMark') }}</b>
          <i :title="$t('rest.outlineForm.remove')" @click="removeCharacter(name)">×</i>
        </span>
        <el-select v-model="adding" filterable allow-create default-first-option :placeholder="$t('rest.outlineForm.addPh')" size="small"
          class="add-select" popper-class="cj-popper" @change="addCharacter">
          <el-option v-for="name in characterOptions" :key="name" :label="name" :value="name" />
        </el-select>
      </div>
      <div v-for="item in missingHints" :key="item.name" class="cj-warn-box hint">
        {{ item.similar ? $t('rest.outlineForm.noCardSimilar', { name: item.name, similar: item.similar }) : $t('rest.outlineForm.noCard', { name: item.name }) }}
        <div style="margin-top: 6px; display: flex; gap: 6px">
          <button v-if="item.similar" class="cj-btn sm" @click="renameCharacter(item.name, item.similar)">{{ $t('rest.outlineForm.renameTo', { name: item.similar }) }}</button>
          <button class="cj-btn sm" @click="createCard(item.name)">{{ $t('rest.outlineForm.createCard') }}</button>
        </div>
      </div>
    </div>
    <div class="row inline">
      <label>{{ $t('rest.outlineForm.words') }}</label>
      <el-input-number v-model="form.target_words" :min="300" :max="20000" :step="500" controls-position="right" :placeholder="$t('rest.outlineForm.defaultWordsPh')" @change="save" />
      <span class="cj-muted" style="font-size: 12px">{{ form.target_words ? '' : $t('rest.outlineForm.usingDefault', { count: defaultWords }) }}</span>
    </div>
    <div class="row">
      <label>{{ $t('rest.outlineForm.links') }}</label>
      <el-select v-model="form.foreshadows" multiple filterable :placeholder="$t('rest.outlineForm.linksPh')" popper-class="cj-popper" style="width: 100%" @change="save">
        <el-option v-for="item in foreshadowOptions" :key="item.id" :label="`${item.code} ${item.content}`" :value="item.id" />
      </el-select>
      <div class="cj-muted" style="font-size: 12px; margin-top: 4px">{{ $t('rest.outlineForm.linksHint') }}</div>
    </div>
    <div class="save-state cj-muted">{{ saving ? $t('rest.outlineForm.saving') : (savedOnce ? $t('rest.outlineForm.saved') : '') }}</div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { cjApi, toastError } from '../api.js'

const { t } = useI18n()

const props = defineProps({
  chapter: { type: Object, required: true },
  bookId: { type: Number, required: true },
  defaultWords: { type: Number, default: 2500 },
  compact: { type: Boolean, default: false }
})
const emit = defineEmits(['saved'])

const fields = computed(() => [
  { key: 'goal', label: t('rest.outlineForm.goal'), placeholder: t('rest.outlineForm.goalPh') },
  { key: 'conflict', label: t('rest.outlineForm.conflict'), placeholder: t('rest.outlineForm.conflictPh') },
  { key: 'payoff', label: t('rest.outlineForm.payoff'), placeholder: t('rest.outlineForm.payoffPh') },
  { key: 'hook', label: t('rest.outlineForm.hook'), placeholder: t('rest.outlineForm.hookPh') }
])

const form = reactive({ title: '', goal: '', conflict: '', payoff: '', hook: '', characters: [], foreshadows: [], target_words: null })
const cards = ref([])
const foreshadows = ref([])
const adding = ref('')
const saving = ref(false)
const savedOnce = ref(false)

const fill = () => {
  const chapter = props.chapter
  Object.assign(form, {
    title: chapter.title || '',
    goal: chapter.goal || '',
    conflict: chapter.conflict || '',
    payoff: chapter.payoff || '',
    hook: chapter.hook || '',
    characters: [...(chapter.characters || [])],
    foreshadows: [...(chapter.foreshadows || [])],
    target_words: chapter.target_words || null
  })
  savedOnce.value = false
}

const loadRefs = async () => {
  try {
    const [cardJson, fsJson] = await Promise.all([
      cjApi(`/books/${props.bookId}/cards?kind=character`),
      cjApi(`/books/${props.bookId}/foreshadows`)
    ])
    cards.value = cardJson.data.cards
    foreshadows.value = fsJson.data.list
  } catch (err) {
    toastError(err)
  }
}

watch(() => props.chapter.id, () => { fill(); loadRefs() }, { immediate: true })

const cardNames = computed(() => cards.value.flatMap(card => [card.name, ...String(card.aliases || '').split(/[,，、\s]+/).filter(Boolean)]))
const hasCard = (name) => cardNames.value.includes(name)
const characterOptions = computed(() => cards.value.map(card => card.name).filter(name => !form.characters.includes(name)))
const foreshadowOptions = computed(() => foreshadows.value.filter(item => item.status === 'open' || form.foreshadows.includes(item.id)))

// 名字只差一个字的，提示是不是写错了
const similarName = (name) => cards.value.map(card => card.name).find(item => item !== name && item.length === name.length && [...item].filter((char, index) => name[index] === char).length >= item.length - 1)
const missingHints = computed(() => form.characters.filter(name => !hasCard(name)).map(name => ({ name, similar: similarName(name) })))

const save = async () => {
  saving.value = true
  try {
    await cjApi(`/chapters/${props.chapter.id}`, { method: 'PUT', body: { ...form, target_words: form.target_words || null } })
    savedOnce.value = true
    emit('saved')
  } catch (err) {
    toastError(err)
  } finally {
    saving.value = false
  }
}

const addCharacter = (name) => {
  const value = String(name || '').trim()
  adding.value = ''
  if (!value || form.characters.includes(value)) return
  form.characters.push(value)
  save()
}
const removeCharacter = (name) => {
  form.characters = form.characters.filter(item => item !== name)
  save()
}
const renameCharacter = (from, to) => {
  form.characters = [...new Set(form.characters.map(item => (item === from ? to : item)))]
  save()
}
const createCard = async (name) => {
  try {
    await cjApi('/cards', { method: 'POST', body: { book_id: props.bookId, kind: 'character', name } })
    ElMessage.success(t('rest.outlineForm.created', { name }))
    await loadRefs()
  } catch (err) {
    toastError(err)
  }
}

defineExpose({ reload: () => { fill(); loadRefs() }, addCharacter })
</script>

<style scoped>
.outline-form { display: flex; flex-direction: column; gap: 14px; }
.row > label { display: block; font-size: 12px; color: var(--cj-sub); margin-bottom: 6px; font-weight: 600; }
.row.inline { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.row.inline > label { margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; background: var(--cj-green-soft); color: var(--cj-green); font-size: 12px; }
.chip.missing { background: var(--cj-red-soft); color: var(--cj-red); }
.chip b { font-weight: 600; font-size: 11px; }
.chip i { font-style: normal; cursor: pointer; opacity: .6; margin-left: 2px; }
.chip i:hover { opacity: 1; }
.add-select { width: 120px; }
.hint { margin-top: 8px; font-size: 12px; }
.save-state { font-size: 12px; text-align: right; min-height: 16px; }
.compact .row > label { margin-bottom: 4px; }
</style>
