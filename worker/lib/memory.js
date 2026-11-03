import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { formatCard, formatForeshadow, parseJson } from './common.js'

// 人物卡字段：基本设定 + 当前状态；关键状态（存活/在场/境界）的改动必须手动确认
export const CHARACTER_BASE_FIELDS = [
  ['role', '身份'], ['appearance', '外貌'], ['personality', '性格'], ['catchphrase', '口头禅'], ['arc', '成长弧线']
]
export const CHARACTER_STATE_FIELDS = [
  ['alive', '存活'], ['present', '在场'], ['realm', '境界'], ['location', '位置'], ['injury', '伤势'], ['items', '持有物品'], ['last_seen', '最后出场']
]
export const KEY_STATE_FIELDS = ['alive', 'present', 'realm']
export const SETTING_CATEGORIES = ['地点', '势力', '物品', '规则', '时间线', '境界', '其他']

const FIELD_LABELS = Object.fromEntries([...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS])
const LABEL_TO_FIELD = Object.fromEntries([...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS].map(([key, label]) => [label, key]))

export const fieldLabel = (field) => {
  if (String(field).startsWith('relation:')) return `关系·${String(field).slice(9)}`
  return FIELD_LABELS[field] || field
}

// 兼容模型返回中文字段名或"关系·某人"
export const normalizeField = (field) => {
  const value = String(field || '').trim()
  if (!value) return ''
  if (FIELD_LABELS[value]) return value
  if (LABEL_TO_FIELD[value]) return LABEL_TO_FIELD[value]
  const relation = value.match(/^(?:关系|relation)[·:：\s-]*(.+)$/i)
  if (relation) return `relation:${relation[1].trim()}`
  if (/死|活/.test(value)) return 'alive'
  if (/离场|在场/.test(value)) return 'present'
  if (/境界|修为|等级/.test(value)) return 'realm'
  if (/位置|地点/.test(value)) return 'location'
  if (/伤/.test(value)) return 'injury'
  if (/物品|持有|道具/.test(value)) return 'items'
  return value
}

export const isKeyField = (field) => KEY_STATE_FIELDS.includes(field)

export const readField = (data, field) => {
  if (String(field).startsWith('relation:')) {
    const name = String(field).slice(9)
    return (Array.isArray(data.relations) ? data.relations : []).find(item => item?.name === name)?.desc || ''
  }
  return data[field] === undefined || data[field] === null ? '' : String(data[field])
}

export const writeField = (data, field, value) => {
  if (String(field).startsWith('relation:')) {
    const name = String(field).slice(9)
    const relations = Array.isArray(data.relations) ? [...data.relations] : []
    const index = relations.findIndex(item => item?.name === name)
    if (index >= 0) relations[index] = { ...relations[index], desc: value }
    else relations.push({ name, desc: value })
    data.relations = relations
    return
  }
  data[field] = value
}

const nameMatches = (card, name) => {
  const target = String(name || '').trim()
  if (!target) return false
  if (card.name === target) return true
  return String(card.aliases || '').split(/[,，、\s]+/).filter(Boolean).includes(target)
}

export const mentionedIn = (card, text) => {
  if (!text) return false
  const names = [card.name, ...String(card.aliases || '').split(/[,，、\s]+/)].filter(item => item && item.length >= 2)
  return names.some(item => text.includes(item))
}

export const listCards = async (bookId, kind, userId) => (kind
  ? (await db.all(sql`SELECT * FROM cj_cards WHERE book_id = ${bookId} AND user_id = ${userId} AND kind = ${kind} ORDER BY id`))
  : (await db.all(sql`SELECT * FROM cj_cards WHERE book_id = ${bookId} AND user_id = ${userId} ORDER BY kind, id`))).map(formatCard)

export const findCardByName = (cards, name) => cards.find(card => nameMatches(card, name))

// 组装本章生成用的记忆库上下文：相关人物卡、设定、未回收伏笔、前情摘要、本卷目标
export const buildContext = async (book, chapter) => {
  const listed = parseJson(chapter.characters, [])
  const linkedForeshadows = parseJson(chapter.foreshadows, [])
  const outlineText = [chapter.title, chapter.goal, chapter.conflict, chapter.payoff, chapter.hook].join('\n')
  const characters = (await listCards(book.id, 'character', book.user_id))
  const settings = (await listCards(book.id, 'setting', book.user_id))
  const warnings = []

  const injectedCharacters = []
  for (const name of listed) {
    const card = findCardByName(characters, name)
    if (card) {
      if (!injectedCharacters.includes(card)) injectedCharacters.push(card)
    } else {
      const similar = characters.find(item => item.name.length === name.length && [...item.name].filter((char, i) => name[i] === char).length >= item.name.length - 1)
      warnings.push({ type: 'no_card', name, suggestion: similar?.name || '', message: similar ? `「${name}」没有人物卡，是不是「${similar.name}」？` : `「${name}」没有人物卡，生成时不会注入他的设定。` })
    }
  }
  for (const card of characters) {
    if (/主角/.test(card.data.role || '') && !injectedCharacters.includes(card)) injectedCharacters.unshift(card)
  }
  for (const card of characters) {
    if (!injectedCharacters.includes(card) && mentionedIn(card, outlineText)) {
      warnings.push({ type: 'not_listed', name: card.name, message: `细纲提到「${card.name}」，但出场人物里没有，他的人物卡未注入。` })
    }
  }

  const injectedSettings = settings.filter(card => card.data.pinned || mentionedIn(card, outlineText))

  const remind = Number(book.foreshadow_remind) || 3
  const listedNames = injectedCharacters.map(card => card.name)
  const foreshadows = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${book.user_id} AND status = 'open' ORDER BY id`))
    .map(formatForeshadow)
    .filter(item => linkedForeshadows.includes(item.id)
      || (item.planned_chapter && item.planned_chapter <= chapter.number + remind)
      || item.characters.some(name => listedNames.includes(name)))

  const summaries = (await db.all(sql`
    SELECT number, title, summary FROM cj_chapters
    WHERE book_id = ${book.id} AND user_id = ${book.user_id} AND number < ${chapter.number} AND summary != ''
    ORDER BY number DESC LIMIT 3
  `)).reverse()

  const volume = chapter.volume_id
    ? (await db.get(sql`SELECT id, title, goal FROM cj_volumes WHERE id = ${chapter.volume_id} AND book_id = ${book.id} AND user_id = ${book.user_id}`))
    : null

  return {
    characters: injectedCharacters,
    settings: injectedSettings,
    foreshadows,
    summaries,
    volume: volume || null,
    warnings
  }
}

// 给前端展示的精简版注入清单
export const contextSummary = (context) => ({
  characters: context.characters.map(card => ({ id: card.id, name: card.name })),
  settings: context.settings.map(card => ({ id: card.id, name: card.name, category: card.category })),
  foreshadows: context.foreshadows.map(item => ({ id: item.id, code: item.code, content: item.content })),
  summaries: context.summaries.map(item => ({ number: item.number, title: item.title })),
  volume: context.volume ? { title: context.volume.title, goal: context.volume.goal } : null,
  warnings: context.warnings
})

export const characterToText = (card) => {
  const data = card.data || {}
  const lines = [`【${card.name}】${card.aliases ? `（别名：${card.aliases}）` : ''}`]
  for (const [key, label] of [...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS]) {
    if (data[key]) lines.push(`${label}：${data[key]}`)
  }
  const relations = (Array.isArray(data.relations) ? data.relations : []).filter(item => item?.name)
  if (relations.length) lines.push(`关系：${relations.map(item => `${item.name}（${item.desc || ''}）`).join('；')}`)
  return lines.join('\n')
}

export const settingToText = (card) => `【${card.name}】${card.category ? `[${card.category}]` : ''} ${card.data?.content || ''}`.trim()

export const foreshadowToText = (item) => `${item.code} ${item.content}（第 ${item.planted_chapter || '?'} 章埋设${item.planned_chapter ? `，计划第 ${item.planned_chapter} 章回收` : ''}）`

// ===== 确认、快照与回滚 =====

const cardSnapshot = (row) => row && ({ id: row.id, kind: row.kind, name: row.name, aliases: row.aliases, category: row.category, data: parseJson(row.data, {}) })
const foreshadowSnapshot = (row) => row && ({
  id: row.id, code: row.code, content: row.content, characters: parseJson(row.characters, []),
  planted_chapter: row.planted_chapter, planned_chapter: row.planned_chapter, status: row.status, resolved_chapter: row.resolved_chapter, note: row.note
})

// 改动明细先算好，写入语句留给调用方一次 batch。payload 在接口里可能已经是对象。
const payloadOf = (change) => {
  const payload = change?.payload
  if (payload && typeof payload === 'object') return payload
  return parseJson(payload, {})
}

const nextCodeFrom = (rows) => {
  const max = rows.reduce((value, row) => Math.max(value, Number.parseInt(String(row.code).replace(/\D/g, ''), 10) || 0), 0)
  return `F${String(max + 1).padStart(3, '0')}`
}

const cardAfter = (card) => card && ({
  id: card.id, kind: card.kind, name: card.name, aliases: card.aliases || '', category: card.category || '', data: card.data || {}
})

const foreshadowAfter = (row) => row && ({
  id: row.id, code: row.code, content: row.content, characters: Array.isArray(row.characters) ? row.characters : [],
  planted_chapter: row.planted_chapter, planned_chapter: row.planned_chapter, status: row.status, resolved_chapter: row.resolved_chapter, note: row.note || ''
})

// 先读出现有卡片和伏笔，在内存里算完改动和插入 id，再返回要一次提交的语句。
export const applyChanges = async ({ userId, book, chapter, changes }) => {
  const before = { cards: {}, foreshadows: {} }
  const touchedCards = new Set()
  const touchedForeshadows = new Set()
  const details = []
  const statements = []
  const rawCards = (await db.all(sql`SELECT * FROM cj_cards WHERE book_id = ${book.id} AND user_id = ${userId}`))
  const rawForeshadows = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${userId}`))
  const cards = rawCards.map(formatCard)
  const foreshadows = rawForeshadows.map(formatForeshadow)
  const originalCards = new Map(rawCards.map(row => [row.id, row]))
  const originalForeshadows = new Map(rawForeshadows.map(row => [row.id, row]))
  // 主键全表递增。按用户取 MAX 会和别人的 id 撞车，所以这里不按 user_id 过滤。
  const cardMax = (await db.get(sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM cj_cards`))
  const foreshadowMax = (await db.get(sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM cj_foreshadows`))
  let nextCardId = Number(cardMax?.max_id) || 0
  let nextForeshadowId = Number(foreshadowMax?.max_id) || 0

  const rememberCard = (id) => {
    if (id in before.cards) return
    const raw = originalCards.get(id)
    before.cards[id] = raw ? cardSnapshot(raw) : null
  }
  const rememberForeshadow = (id) => {
    if (id in before.foreshadows) return
    const raw = originalForeshadows.get(id)
    before.foreshadows[id] = raw ? foreshadowSnapshot(raw) : null
  }
  const insertCard = (kind, name, category, data) => {
    const id = ++nextCardId
    const card = { id, book_id: book.id, kind, name, aliases: '', category: category || '', data }
    cards.push(card)
    rememberCard(id)
    touchedCards.add(id)
    statements.push(sql`
      INSERT INTO cj_cards (id, user_id, book_id, kind, name, category, data)
      VALUES (${id}, ${userId}, ${book.id}, ${kind}, ${name}, ${category || ''}, ${JSON.stringify(data)})
    `)
    return card
  }

  for (const change of changes) {
    const payload = payloadOf(change)
    if (change.kind === 'state' || change.kind === 'key_state') {
      let card = findCardByName(cards.filter(item => item.kind === 'character'), change.target_name)
      if (!card) card = insertCard('character', change.target_name, '', {})
      else rememberCard(card.id)
      const cardId = card.id
      const data = { ...card.data }
      const oldValue = readField(data, change.field)
      writeField(data, change.field, change.new_value)
      card.data = data
      statements.push(sql`UPDATE cj_cards SET data = ${JSON.stringify(data)}, updated_at = datetime('now', '+8 hours') WHERE id = ${cardId} AND user_id = ${userId} AND book_id = ${book.id}`)
      touchedCards.add(cardId)
      details.push({ target_type: 'character', target_id: cardId, target_name: card.name, kind: change.kind, field: change.field, field_label: fieldLabel(change.field), old: oldValue, new: change.new_value, edited: !!change.edited })
    } else if (change.kind === 'new_setting' || change.kind === 'new_character') {
      const kind = change.kind === 'new_setting' ? 'setting' : 'character'
      const name = String(payload.name || change.target_name || '').trim()
      if (!name) continue
      const existing = findCardByName(cards.filter(item => item.kind === kind), name)
      if (existing) {
        rememberCard(existing.id)
        const data = { ...existing.data }
        const oldValue = kind === 'setting' ? (data.content || '') : ''
        if (kind === 'setting') data.content = [data.content, change.new_value].filter(Boolean).join('；')
        else Object.assign(data, payload.data || {})
        existing.data = data
        statements.push(sql`UPDATE cj_cards SET data = ${JSON.stringify(data)}, updated_at = datetime('now', '+8 hours') WHERE id = ${existing.id} AND user_id = ${userId} AND book_id = ${book.id}`)
        touchedCards.add(existing.id)
        details.push({ target_type: kind, target_id: existing.id, target_name: name, kind: change.kind, field: kind === 'setting' ? 'content' : 'data', field_label: kind === 'setting' ? (payload.category || '内容') : '设定', old: oldValue, new: change.new_value, edited: !!change.edited })
      } else {
        const data = kind === 'setting' ? { content: change.new_value } : { ...(payload.data || {}), alive: '是', present: '是' }
        if (kind === 'character' && change.new_value && !data.role) data.role = change.new_value
        const card = insertCard(kind, name, kind === 'setting' ? payload.category : '', data)
        details.push({ target_type: kind, target_id: card.id, target_name: name, kind: change.kind, field: 'created', field_label: kind === 'setting' ? (payload.category || '内容') : '新人物', old: '', new: change.new_value, created: true, edited: !!change.edited })
      }
    } else if (change.kind === 'new_foreshadow') {
      const code = nextCodeFrom(foreshadows)
      const id = ++nextForeshadowId
      const characters = Array.isArray(payload.characters) ? payload.characters : []
      const planned = payload.planned_chapter || null
      foreshadows.push({ id, book_id: book.id, code, content: change.new_value, characters, planted_chapter: chapter.number, planned_chapter: planned, status: 'open', resolved_chapter: null, note: '' })
      rememberForeshadow(id)
      touchedForeshadows.add(id)
      statements.push(sql`
        INSERT INTO cj_foreshadows (id, user_id, book_id, code, content, characters, planted_chapter, planned_chapter)
        VALUES (${id}, ${userId}, ${book.id}, ${code}, ${change.new_value}, ${JSON.stringify(characters)}, ${chapter.number}, ${planned})
      `)
      details.push({ target_type: 'foreshadow', target_id: id, target_name: code, kind: change.kind, field: 'created', field_label: '内容', old: '', new: change.new_value, planned_chapter: planned, created: true, edited: !!change.edited })
    } else if (change.kind === 'resolve_foreshadow') {
      const row = payload.foreshadow_id
        ? foreshadows.find(item => Number(item.id) === Number(payload.foreshadow_id))
        : foreshadows.find(item => item.code === change.target_name)
      if (!row) continue
      rememberForeshadow(row.id)
      row.status = 'resolved'
      row.resolved_chapter = chapter.number
      statements.push(sql`UPDATE cj_foreshadows SET status = 'resolved', resolved_chapter = ${chapter.number}, updated_at = datetime('now', '+8 hours') WHERE id = ${row.id} AND user_id = ${userId} AND book_id = ${book.id}`)
      touchedForeshadows.add(row.id)
      details.push({ target_type: 'foreshadow', target_id: row.id, target_name: row.code, kind: change.kind, field: 'status', field_label: '状态', old: '未回收', new: `第 ${chapter.number} 章回收`, edited: !!change.edited })
    }
  }

  const after = { cards: {}, foreshadows: {} }
  for (const id of touchedCards) after.cards[id] = cardAfter(cards.find(item => item.id === id))
  for (const id of touchedForeshadows) after.foreshadows[id] = foreshadowAfter(foreshadows.find(item => item.id === id))
  return { before, after, details, statements }
}

export const restoreCardStatement = (userId, bookId, id, snapshot) => {
  if (!snapshot) return sql`DELETE FROM cj_cards WHERE id = ${id} AND book_id = ${bookId} AND user_id = ${userId}`
  const data = JSON.stringify(snapshot.data || {})
  return sql`
    INSERT INTO cj_cards (id, user_id, book_id, kind, name, aliases, category, data)
    VALUES (${id}, ${userId}, ${bookId}, ${snapshot.kind}, ${snapshot.name}, ${snapshot.aliases || ''}, ${snapshot.category || ''}, ${data})
    ON CONFLICT(id) DO UPDATE SET
      name = ${snapshot.name}, aliases = ${snapshot.aliases || ''}, category = ${snapshot.category || ''},
      data = ${data}, updated_at = datetime('now', '+8 hours')
    WHERE user_id = ${userId}
  `
}

const restoreForeshadowStatement = (userId, bookId, id, snapshot) => {
  if (!snapshot) return sql`DELETE FROM cj_foreshadows WHERE id = ${id} AND book_id = ${bookId} AND user_id = ${userId}`
  const characters = JSON.stringify(snapshot.characters || [])
  return sql`
    INSERT INTO cj_foreshadows (id, user_id, book_id, code, content, characters, planted_chapter, planned_chapter, status, resolved_chapter, note)
    VALUES (${id}, ${userId}, ${bookId}, ${snapshot.code}, ${snapshot.content}, ${characters}, ${snapshot.planted_chapter}, ${snapshot.planned_chapter}, ${snapshot.status}, ${snapshot.resolved_chapter}, ${snapshot.note || ''})
    ON CONFLICT(id) DO UPDATE SET
      code = ${snapshot.code}, content = ${snapshot.content}, characters = ${characters},
      planted_chapter = ${snapshot.planted_chapter}, planned_chapter = ${snapshot.planned_chapter},
      status = ${snapshot.status}, resolved_chapter = ${snapshot.resolved_chapter}, note = ${snapshot.note || ''},
      updated_at = datetime('now', '+8 hours')
    WHERE user_id = ${userId}
  `
}

// 撤销一次确认：卡片和伏笔还原到确认前，正文保留，章节回到草稿。语句交给调用方一次提交。
export const revertStatements = (userId, version) => {
  const before = parseJson(version.before_state, { cards: {}, foreshadows: {} })
  const statements = []
  for (const [id, snapshot] of Object.entries(before.cards || {})) statements.push(restoreCardStatement(userId, version.book_id, Number(id), snapshot))
  for (const [id, snapshot] of Object.entries(before.foreshadows || {})) statements.push(restoreForeshadowStatement(userId, version.book_id, Number(id), snapshot))
  statements.push(sql`UPDATE cj_chapters SET status = 'draft', confirmed_at = NULL, summary = '', updated_at = datetime('now', '+8 hours') WHERE id = ${version.chapter_id} AND user_id = ${userId}`)
  statements.push(sql`UPDATE cj_versions SET reverted = 1, reverted_at = datetime('now', '+8 hours') WHERE id = ${version.id} AND user_id = ${userId}`)
  return statements
}

// 只还原一张卡。这次确认没改过这张卡时返回 null，调用方不要写库。
export const restoreCardStatementFor = (userId, version, cardId) => {
  const before = parseJson(version.before_state, { cards: {} })
  if (!(String(cardId) in (before.cards || {}))) return null
  return restoreCardStatement(userId, version.book_id, Number(cardId), before.cards[String(cardId)])
}
