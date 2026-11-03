import { cleanList, cleanText, parseJson } from './common.js'
import { readCardInput } from './card-fields.js'
import { CHARACTER_BASE_FIELDS, CHARACTER_STATE_FIELDS, SETTING_CATEGORIES } from './memory.js'

// 模型在回复末尾用这块标记给出修改建议。解析失败就当普通文字，不报错。
export const SUGGESTION_MARKER = '<<<cj-suggestions>>>'
export const SUGGESTION_END = '<<<end>>>'

export const ASSIST_TARGET_TYPES = ['book', 'volume', 'chapter', 'card', 'new_book']
export const SUGGESTION_LIMIT = 30
export const NEW_BOOK_VOLUME_LIMIT = 8
export const NEW_BOOK_CHAPTER_LIMIT = 30
export const NEW_BOOK_CARD_LIMIT = 20

const CHAPTER_KEYS = ['number', 'title', 'goal', 'conflict', 'payoff', 'hook', 'characters', 'foreshadows', 'target_words', 'volume_id']
const VOLUME_KEYS = ['title', 'goal', 'outline']
const BOOK_KEYS = ['title', 'chapter_words', 'foreshadow_remind', 'world', 'outline']

const ALIASES = {
  书名: 'title', 标题: 'title', 章名: 'title', 卷名: 'title',
  总纲: 'outline', 大纲: 'outline', 分卷大纲: 'outline', 简介: 'outline',
  世界观: 'world',
  本卷目标: 'goal', 本章目标: 'goal', 目标: 'goal',
  冲突: 'conflict', 爽点: 'payoff', 钩子: 'hook', 章末钩子: 'hook',
  出场人物: 'characters', 人物: 'characters',
  伏笔: 'foreshadows', 关联伏笔: 'foreshadows',
  目标字数: 'target_words', 每章字数: 'chapter_words', 字数: 'target_words',
  章号: 'number', 分卷: 'volume_id',
  伏笔提醒: 'foreshadow_remind',
  名称: 'name', 别名: 'aliases', 类别: 'category', 类型: 'kind',
  内容: 'content', 固定注入: 'pinned', 置顶: 'pinned'
}

export const fieldLabel = (type, field) => {
  if (field === 'outline' && type === 'book') return '总纲'
  if (field === 'outline') return '分卷大纲'
  if (field === 'goal' && type === 'volume') return '本卷目标'
  if (field === 'goal') return '本章目标'
  if (field === 'title' && type === 'book') return '书名'
  if (field === 'title' && type === 'volume') return '卷名'
  if (field === 'title') return '章节标题'
  const labels = {
    chapter_words: '每章字数', foreshadow_remind: '伏笔提醒', world: '世界观',
    conflict: '冲突', payoff: '爽点', hook: '章末钩子', characters: '出场人物', foreshadows: '关联伏笔',
    target_words: '目标字数', number: '章号', volume_id: '分卷', name: '名称', aliases: '别名',
    category: '类别', kind: '类型', content: '内容', pinned: '固定注入', role: '身份', appearance: '外貌',
    personality: '性格', catchphrase: '口头禅', arc: '成长弧线', alive: '存活', present: '在场',
    realm: '境界', location: '位置', injury: '伤势', items: '持有物品', last_seen: '最后出场', relations: '关系'
  }
  return labels[field] || field
}

const strictInt = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10)
  return null
}

const takeInt = (value, min, max) => {
  const number = strictInt(value)
  if (number === null || number < min || number > max) return undefined
  return number
}

const renameFields = (fields) => {
  const next = {}
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return next
  for (const [key, value] of Object.entries(fields)) next[ALIASES[key] || key] = value
  return next
}

const takeText = (value, max) => cleanText(value, max)

const takeNameList = (value) => {
  if (Array.isArray(value)) return cleanList(value, 30)
  if (typeof value === 'string') return cleanList(value.split(/[,，、]/), 30)
  return undefined
}

const takeIdList = (value) => {
  if (!Array.isArray(value)) return undefined
  const ids = value.map(item => strictInt(item)).filter(item => item && item > 0)
  if (ids.length !== value.length) return undefined
  return [...new Set(ids)]
}

// 章节细纲。非法数字和未知字段丢掉，不让它们进建议。
export const cleanChapterFields = (input, { creating = false } = {}) => {
  const fields = renameFields(input)
  const next = {}
  if (fields.number !== undefined) {
    const number = takeInt(fields.number, 1, 100000)
    if (number !== undefined) next.number = number
  }
  if (fields.title !== undefined) next.title = takeText(fields.title, 60)
  for (const key of ['goal', 'conflict', 'payoff', 'hook']) {
    if (fields[key] !== undefined) next[key] = takeText(fields[key], 2000)
  }
  if (fields.characters !== undefined) {
    const names = takeNameList(fields.characters)
    if (names) next.characters = names
  }
  if (fields.foreshadows !== undefined) {
    const ids = takeIdList(fields.foreshadows)
    if (ids) next.foreshadows = ids
  }
  if (fields.target_words === null) next.target_words = null
  else if (fields.target_words !== undefined) {
    const words = takeInt(fields.target_words, 300, 20000)
    if (words !== undefined) next.target_words = words
  }
  if (fields.volume_id !== undefined) {
    const volumeId = takeInt(fields.volume_id, 1, 100000000)
    if (volumeId !== undefined) next.volume_id = volumeId
  }
  if (creating && !next.title && !next.goal && !next.conflict && !next.payoff && !next.hook) return null
  if (!Object.keys(next).length) return null
  return next
}

export const cleanVolumeFields = (input, { creating = false } = {}) => {
  const fields = renameFields(input)
  const next = {}
  if (fields.title !== undefined) next.title = takeText(fields.title, 60)
  if (fields.goal !== undefined) next.goal = takeText(fields.goal, 2000)
  if (fields.outline !== undefined) next.outline = takeText(fields.outline, 50000)
  if (creating && !next.title) return null
  if (!Object.keys(next).length) return null
  return next
}

export const cleanBookFields = (input) => {
  const fields = renameFields(input)
  const next = {}
  if (fields.title !== undefined) {
    const title = takeText(fields.title, 60).trim()
    if (title) next.title = title
  }
  if (fields.chapter_words !== undefined) {
    const words = takeInt(fields.chapter_words, 300, 20000)
    if (words !== undefined) next.chapter_words = words
  }
  if (fields.foreshadow_remind !== undefined) {
    const remind = takeInt(fields.foreshadow_remind, 0, 50)
    if (remind !== undefined) next.foreshadow_remind = remind
  }
  if (fields.world !== undefined) next.world = takeText(fields.world, 100000)
  if (fields.outline !== undefined) next.outline = takeText(fields.outline, 100000)
  if (!Object.keys(next).length) return null
  return next
}

const takePinned = (value) => value === true || value === 1 || value === '1' || value === 'true' || value === '是'

const cardBody = (fields, creating) => {
  const data = fields.data && typeof fields.data === 'object' && !Array.isArray(fields.data) ? { ...fields.data } : {}
  for (const [key, value] of Object.entries(fields)) {
    if (['kind', 'name', 'aliases', 'category', 'data', 'chapters', 'volumes', 'cards'].includes(key)) continue
    if (data[key] === undefined) data[key] = value
  }
  if (data.pinned !== undefined) data.pinned = takePinned(data.pinned)
  const kind = fields.kind === 'setting' || fields.kind === 'character' ? fields.kind : (creating ? '' : undefined)
  return { kind, name: fields.name, aliases: fields.aliases, category: fields.category, data }
}

const LOOSE_CARD_KEYS = new Set([
  ...CHARACTER_BASE_FIELDS.map(([key]) => key),
  ...CHARACTER_STATE_FIELDS.map(([key]) => key),
  'relations', 'content', 'pinned'
])

// 更新已有卡片时，模型常常不写 kind。先收下白名单字段，应用时再按卡片真实类型校验。
const stashLooseCard = (body) => {
  const next = {}
  if (body.name !== undefined) {
    const name = takeText(body.name, 60).trim()
    if (name) next.name = name
  }
  if (body.aliases !== undefined) next.aliases = takeText(body.aliases, 200).trim()
  if (body.category !== undefined) {
    const category = takeText(body.category, 20).trim()
    if (category && !SETTING_CATEGORIES.includes(category)) return null
    if (category) next.category = category
  }
  const data = {}
  for (const [key, value] of Object.entries(body.data || {})) {
    if (LOOSE_CARD_KEYS.has(key)) data[key] = value
  }
  if (Object.keys(data).length) next.data = data
  if (!next.name && next.aliases === undefined && !next.category && !next.data) return null
  return next
}

// 人物卡和设定卡走卡片白名单。创建时必须有类型和名字。
export const cleanCardFields = (input, { creating = false, current = null } = {}) => {
  const fields = renameFields(input)
  const body = cardBody(fields, creating)
  if (creating && body.kind !== 'character' && body.kind !== 'setting') return null
  if (!creating && !body.kind && !current) return stashLooseCard(body)
  const kind = body.kind || current?.kind || 'character'
  if (kind === 'setting' && body.category && !SETTING_CATEGORIES.includes(String(body.category).trim())) return null
  const base = current || { kind, name: '未命名', aliases: '', category: '', data: {} }
  let inputCard
  try {
    inputCard = readCardInput({
      kind,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.aliases !== undefined ? { aliases: body.aliases } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      data: body.data
    }, creating ? { kind } : base)
  } catch {
    return null
  }
  if (creating && (!inputCard.name || inputCard.name === '未命名') && !String(fields.name || '').trim()) return null
  const next = {}
  if (creating || fields.kind) next.kind = inputCard.kind
  if (creating || fields.name !== undefined) next.name = inputCard.name
  if (creating || fields.aliases !== undefined) next.aliases = inputCard.aliases
  if (creating || fields.category !== undefined) next.category = inputCard.category
  const data = {}
  const source = body.data || {}
  for (const key of Object.keys(source)) {
    if (inputCard.data[key] !== undefined) data[key] = inputCard.data[key]
    if (key === 'relations' && inputCard.data.relations) data.relations = inputCard.data.relations
    if (key === 'pinned') data.pinned = !!inputCard.data.pinned
    if (key === 'content' && inputCard.data.content !== undefined) data.content = inputCard.data.content
  }
  if (creating && kind === 'character') {
    if (data.alive === undefined) data.alive = '是'
    if (data.present === undefined) data.present = '是'
  }
  if (Object.keys(data).length) next.data = data
  if (creating && !next.name) return null
  if (!creating && !next.name && !next.aliases && !next.category && !next.data) return null
  return next
}

export const cleanNewBookFields = (input) => {
  const fields = renameFields(input)
  const next = cleanBookFields(fields) || {}
  if (Array.isArray(fields.volumes)) {
    const volumes = []
    let chapterCount = 0
    for (const volume of fields.volumes.slice(0, NEW_BOOK_VOLUME_LIMIT)) {
      if (!volume || typeof volume !== 'object') continue
      const cleaned = cleanVolumeFields(volume, { creating: true })
      if (!cleaned) continue
      const chapters = []
      if (Array.isArray(volume.chapters)) {
        for (const chapter of volume.chapters) {
          if (chapterCount >= NEW_BOOK_CHAPTER_LIMIT) break
          const item = cleanChapterFields(chapter, { creating: true })
          if (!item) continue
          chapters.push(item)
          chapterCount += 1
        }
      }
      volumes.push({ ...cleaned, chapters })
    }
    if (volumes.length) next.volumes = volumes
  }
  if (Array.isArray(fields.cards)) {
    const cards = []
    for (const card of fields.cards) {
      if (cards.length >= NEW_BOOK_CARD_LIMIT) break
      const item = cleanCardFields(card, { creating: true })
      if (!item) continue
      cards.push(item)
    }
    if (cards.length) next.cards = cards
  }
  if (!next.title && !next.world && !next.outline && !next.volumes?.length && !next.cards?.length && !next.chapter_words) return null
  return next
}

const targetIdOf = (value) => {
  if (value === 'new') return 'new'
  const id = strictInt(value)
  if (id && id > 0) return id
  return null
}

export const sanitizeOne = (item) => {
  if (!item || typeof item !== 'object') return null
  const targetType = String(item.target_type || item.type || '').trim()
  if (!ASSIST_TARGET_TYPES.includes(targetType)) return null
  const rawFields = item.fields && typeof item.fields === 'object' ? item.fields : item
  const fieldsInput = { ...rawFields }
  delete fieldsInput.target_type
  delete fieldsInput.target_id
  delete fieldsInput.type
  delete fieldsInput.id
  delete fieldsInput.status
  if (targetType === 'new_book') {
    const fields = cleanNewBookFields(fieldsInput)
    if (!fields) return null
    return { target_type: 'new_book', target_id: 'new', fields }
  }
  const rawId = item.target_id
  const omitted = rawId === undefined || rawId === null || rawId === ''
  const targetId = omitted ? null : targetIdOf(rawId)
  if (!omitted && !targetId) return null
  const creating = targetId === 'new'
  let fields = null
  if (targetType === 'book') fields = creating ? null : cleanBookFields(fieldsInput)
  else if (targetType === 'volume') fields = cleanVolumeFields(fieldsInput, { creating })
  else if (targetType === 'chapter') fields = cleanChapterFields(fieldsInput, { creating })
  else if (targetType === 'card') fields = cleanCardFields(fieldsInput, { creating })
  if (!fields) return null
  return { target_type: targetType, target_id: targetId, fields }
}

// 标记块不是合法 JSON，或没有建议数组时，ok 为 false，调用方保留原文。
export const sanitizeSuggestions = (payload) => {
  const list = Array.isArray(payload) ? payload : payload?.suggestions || payload?.items
  if (!Array.isArray(list)) return { ok: false, suggestions: [] }
  const suggestions = []
  for (const item of list) {
    const clean = sanitizeOne(item)
    if (!clean) continue
    suggestions.push({ ...clean, id: `s${suggestions.length + 1}`, status: 'pending' })
    if (suggestions.length >= SUGGESTION_LIMIT) break
  }
  return { ok: true, suggestions }
}

export const splitSuggestionText = (text) => {
  const raw = String(text || '')
  const start = raw.indexOf(SUGGESTION_MARKER)
  if (start < 0) return { content: raw.trim(), payload: null, parsed: false }
  const after = raw.slice(start + SUGGESTION_MARKER.length)
  const end = after.indexOf(SUGGESTION_END)
  let block = (end >= 0 ? after.slice(0, end) : after).trim()
  block = block.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const payload = parseJson(block, null)
  if (!payload || typeof payload !== 'object') return { content: raw.trim(), payload: null, parsed: false }
  return { content: raw.slice(0, start).trim(), payload, parsed: true }
}

// 没写 id 时，默认改当前对话的对象，避免模型漏写 id 就整段作废。
export const bindDefaultTarget = (item, chat) => {
  if (!item) return item
  if (item.target_type === 'new_book') return { ...item, target_id: 'new' }
  if (item.target_id && item.target_id !== 'new') return item
  if (item.target_id === 'new') return item
  if (chat?.target_type === item.target_type && chat.target_id) return { ...item, target_id: chat.target_id }
  if (item.target_type === 'book' && chat?.book_id) return { ...item, target_id: chat.book_id }
  return item
}

export const ownsTarget = (item, scope) => {
  if (!item) return false
  if (item.target_type === 'new_book') return !!scope?.allowNewBook && !scope?.bookId
  if (!scope?.bookId) return false
  if (item.target_id === 'new') return item.target_type === 'volume' || item.target_type === 'chapter' || item.target_type === 'card'
  if (item.target_type === 'book') return Number(item.target_id) === Number(scope.bookId)
  if (item.target_type === 'volume') return scope.volumeIds?.has(Number(item.target_id))
  if (item.target_type === 'chapter') return scope.chapterIds?.has(Number(item.target_id))
  if (item.target_type === 'card') return scope.cardIds?.has(Number(item.target_id))
  return false
}

export const classifyTargets = (suggestions, scope) => {
  const accepted = []
  const rejected = []
  for (const item of suggestions || []) {
    if (ownsTarget(item, scope)) accepted.push(item)
    else rejected.push(item)
  }
  return { accepted, rejected }
}

export const interpretReply = (text, chat, scope) => {
  const split = splitSuggestionText(text)
  if (!split.parsed) return { content: String(text || '').trim(), suggestions: [] }
  const sanitized = sanitizeSuggestions(split.payload)
  if (!sanitized.ok) return { content: String(text || '').trim(), suggestions: [] }
  const bound = sanitized.suggestions.map(item => bindDefaultTarget(item, chat))
  const { accepted } = classifyTargets(bound, scope)
  const refined = accepted.map(item => {
    if (item.target_type !== 'card' || item.target_id === 'new') return item
    const current = (scope?.cards || []).find(card => card.id === Number(item.target_id))
    if (!current) return item
    const fields = cleanCardFields(item.fields, { creating: false, current })
    return fields ? { ...item, fields } : null
  }).filter(Boolean)
  const suggestions = refined.map((item, index) => ({ ...item, id: `s${index + 1}`, status: 'pending' }))
  const content = split.content || (suggestions.length ? '请看下面的修改建议。' : '')
  return { content, suggestions }
}

export const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) {
    return value.map(item => {
      if (item && typeof item === 'object') return [item.name, item.desc].filter(Boolean).join('：')
      return String(item)
    }).join('、')
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

const flatFields = (type, fields) => {
  const rows = []
  if (!fields || typeof fields !== 'object') return rows
  for (const key of Object.keys(fields)) {
    if (['data', 'volumes', 'cards', 'chapters'].includes(key)) continue
    rows.push({ field: key, label: fieldLabel(type, key), value: fields[key] })
  }
  if (fields.data && typeof fields.data === 'object') {
    for (const key of Object.keys(fields.data)) {
      rows.push({ field: key, label: fieldLabel('card', key), value: fields.data[key], inData: true })
    }
  }
  return rows
}

export const suggestionChanges = (type, fields, before = {}) => flatFields(type, fields).map(row => ({
  field: row.field,
  label: row.label,
  in_data: !!row.inData,
  before: displayValue(before[row.field]),
  after: displayValue(row.value)
}))

// 流式转发时先按住标记的前缀，避免界面闪出半截 <<<cj-sugges。
export const markerHoldLength = (text) => {
  const raw = String(text || '')
  const at = raw.indexOf(SUGGESTION_MARKER)
  if (at >= 0) return at
  const max = Math.min(raw.length, SUGGESTION_MARKER.length - 1)
  for (let size = max; size > 0; size -= 1) {
    if (SUGGESTION_MARKER.startsWith(raw.slice(-size))) return raw.length - size
  }
  return raw.length
}
