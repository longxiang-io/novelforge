import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { CjError, cleanText, formatCard, parseJson } from './common.js'
import { readCardInput } from './card-fields.js'
import { restoreCardStatement } from './memory.js'
import { DEFAULT_OUTLINE, DEFAULT_WORLD } from './book-defaults.js'
import {
  ASSIST_TARGET_TYPES, cleanCardFields, cleanNewBookFields, displayValue, ownsTarget, sanitizeOne, suggestionChanges
} from './assist-schema.js'

const same = (left, right) => displayValue(left) === displayValue(right)

const asList = (value) => {
  if (Array.isArray(value)) return value
  return parseJson(value, [])
}

const chapterSnapshot = (chapter) => ({
  volume_id: chapter.volume_id ?? null,
  number: chapter.number,
  title: chapter.title || '',
  goal: chapter.goal || '',
  conflict: chapter.conflict || '',
  payoff: chapter.payoff || '',
  hook: chapter.hook || '',
  characters: JSON.stringify(asList(chapter.characters)),
  foreshadows: JSON.stringify(asList(chapter.foreshadows)),
  target_words: chapter.target_words ?? null
})

const bookSnapshot = (book) => ({
  title: book.title,
  chapter_words: book.chapter_words,
  foreshadow_remind: book.foreshadow_remind,
  budget: book.budget,
  world: book.world || '',
  outline: book.outline || ''
})

const volumeSnapshot = (volume) => ({
  sort: volume.sort,
  title: volume.title || '',
  goal: volume.goal || '',
  outline: volume.outline || ''
})

const cardSnapshot = (card) => ({
  kind: card.kind,
  name: card.name,
  aliases: card.aliases || '',
  category: card.category || '',
  data: JSON.parse(JSON.stringify(card.data || {}))
})

export const loadAssistScope = async (userId, bookId, { allowNewBook = false } = {}) => {
  if (!bookId) {
    return {
      userId, bookId: null, book: null, allowNewBook,
      volumes: [], chapters: [], cards: [], foreshadows: [],
      volumeIds: new Set(), chapterIds: new Set(), cardIds: new Set(), foreshadowIds: new Set()
    }
  }
  const book = await db.get(sql`
    SELECT id, user_id, title, chapter_words, foreshadow_remind, budget, world, outline
    FROM cj_books WHERE id = ${bookId} AND user_id = ${userId}
  `)
  if (!book) return null
  const volumes = await db.all(sql`
    SELECT id, book_id, sort, title, goal, outline FROM cj_volumes
    WHERE book_id = ${bookId} AND user_id = ${userId} ORDER BY sort, id
  `)
  const chapters = (await db.all(sql`
    SELECT id, book_id, volume_id, number, title, goal, conflict, payoff, hook, characters, foreshadows, target_words, summary, status
    FROM cj_chapters WHERE book_id = ${bookId} AND user_id = ${userId} ORDER BY number
  `)).map(row => ({ ...row, characters: asList(row.characters), foreshadows: asList(row.foreshadows) }))
  const cards = (await db.all(sql`SELECT * FROM cj_cards WHERE book_id = ${bookId} AND user_id = ${userId} ORDER BY id`)).map(formatCard)
  const foreshadows = await db.all(sql`SELECT id, code FROM cj_foreshadows WHERE book_id = ${bookId} AND user_id = ${userId}`)
  return {
    userId,
    bookId: book.id,
    book,
    allowNewBook: false,
    volumes,
    chapters,
    cards,
    foreshadows,
    volumeIds: new Set(volumes.map(item => item.id)),
    chapterIds: new Set(chapters.map(item => item.id)),
    cardIds: new Set(cards.map(item => item.id)),
    foreshadowIds: new Set(foreshadows.map(item => item.id))
  }
}

export const getChat = async (userId, id) => {
  const chat = await db.get(sql`SELECT * FROM cj_ai_chats WHERE id = ${id} AND user_id = ${userId}`)
  if (!chat) throw new CjError(404, '对话不存在或无权访问')
  return chat
}

export const getChatMessage = async (userId, chatId, messageId) => {
  const message = await db.get(sql`
    SELECT * FROM cj_ai_messages WHERE id = ${messageId} AND chat_id = ${chatId} AND user_id = ${userId}
  `)
  if (!message) throw new CjError(404, '消息不存在或无权访问')
  return message
}

const titleOf = (value) => cleanText(value, 40).trim()

export const assertChatTarget = async (userId, body) => {
  const targetType = String(body.target_type || '')
  if (!ASSIST_TARGET_TYPES.includes(targetType)) throw new CjError(400, '对话对象不正确')
  const bookId = Number(body.book_id) || null
  const targetId = Number(body.target_id) || null
  const title = titleOf(body.title)
  if (targetType === 'new_book') {
    if (bookId || targetId) throw new CjError(400, '新书构思先不要选书')
    return { book_id: null, target_type: 'new_book', target_id: null, title }
  }
  if (!bookId) throw new CjError(400, '请选择一本书')
  const scope = await loadAssistScope(userId, bookId)
  if (!scope) throw new CjError(404, '书不存在或无权访问')
  if (targetType === 'book') {
    if (body.target_id && targetId !== bookId) throw new CjError(400, '对话对象不正确')
    return { book_id: bookId, target_type: 'book', target_id: bookId, title }
  }
  if (targetType === 'volume') {
    if (!scope.volumeIds.has(targetId)) throw new CjError(404, '分卷不存在或无权访问')
    return { book_id: bookId, target_type: 'volume', target_id: targetId, title }
  }
  if (targetType === 'chapter') {
    if (!scope.chapterIds.has(targetId)) throw new CjError(404, '章节不存在或无权访问')
    return { book_id: bookId, target_type: 'chapter', target_id: targetId, title }
  }
  if (!targetId) return { book_id: bookId, target_type: 'card', target_id: null, title }
  if (!scope.cardIds.has(targetId)) throw new CjError(404, '卡片不存在或无权访问')
  return { book_id: bookId, target_type: 'card', target_id: targetId, title }
}

const labelFor = (item, scope) => {
  if (item.target_type === 'new_book') return item.fields?.title ? `建书：${item.fields.title}` : '建书方案'
  if (item.target_type === 'book') return '全书总纲'
  if (item.target_type === 'volume') {
    if (item.target_id === 'new') return item.fields?.title ? `新分卷：${item.fields.title}` : '新分卷'
    const volume = scope?.volumes?.find(row => row.id === item.target_id)
    return volume ? `${volume.title} 卷大纲` : '卷大纲'
  }
  if (item.target_type === 'chapter') {
    if (item.target_id === 'new') return item.fields?.number ? `新章节 第 ${item.fields.number} 章` : '新章节细纲'
    const chapter = scope?.chapters?.find(row => row.id === item.target_id)
    return chapter ? `第 ${chapter.number} 章 细纲` : '章节细纲'
  }
  const card = item.target_id === 'new' ? null : scope?.cards?.find(row => row.id === item.target_id)
  const kind = (card?.kind || item.fields?.kind) === 'setting' ? '设定' : '人物'
  const name = card?.name || item.fields?.name || ''
  return name ? `${kind}：${name}` : `新${kind}卡`
}

const beforeOf = (item, scope) => {
  if (!scope || item.target_id === 'new') return {}
  if (item.target_type === 'book') return scope.book || {}
  if (item.target_type === 'volume') return scope.volumes.find(row => row.id === item.target_id) || {}
  if (item.target_type === 'chapter') return scope.chapters.find(row => row.id === item.target_id) || {}
  if (item.target_type === 'card') {
    const card = scope.cards.find(row => row.id === item.target_id)
    if (!card) return {}
    return { name: card.name, aliases: card.aliases, category: card.category, ...(card.data || {}) }
  }
  return {}
}

export const presentSuggestions = (suggestions, scope) => (Array.isArray(suggestions) ? suggestions : []).map(item => {
  const owned = item.target_type === 'new_book' ? !!scope?.allowNewBook && !scope?.bookId : ownsTarget(item, scope)
  const before = beforeOf(item, scope)
  const fields = item.fields || {}
  let changes = []
  if (item.target_type === 'card') {
    const flat = { ...fields, ...(fields.data || {}) }
    delete flat.data
    delete flat.kind
    changes = suggestionChanges('card', flat, before)
  } else if (item.target_type !== 'new_book') {
    changes = suggestionChanges(item.target_type, fields, before)
  } else {
    changes = suggestionChanges('book', {
      title: fields.title, chapter_words: fields.chapter_words, world: fields.world, outline: fields.outline
    }, {})
  }
  return {
    id: item.id,
    status: item.status || 'pending',
    target_type: item.target_type,
    target_id: item.target_id,
    label: labelFor(item, scope),
    created: item.target_id === 'new' || item.target_type === 'new_book',
    invalid: !owned,
    fields,
    plan: item.target_type === 'new_book' ? fields : undefined,
    changes
  }
})

const jsonBool = (value) => (value ? sql`json('true')` : sql`json('false')`)

// 插入之后 last_insert_rowid() 还指着新行。版本里记下这个自增 id，供撤销时删除。
const noteNewRow = (userId, bookId, bucket, detailRows) => {
  let changes = sql`changes`
  for (const row of detailRows) {
    changes = sql`json_insert(${changes}, '$[#]', json_object(
      'target_type', ${row.target_type},
      'target_id', last_insert_rowid(),
      'target_name', ${String(row.target_name || '')},
      'field', ${row.field},
      'field_label', ${row.field_label || row.field},
      'old', ${String(row.old ?? '')},
      'new', ${String(row.new ?? '')},
      'created', json('true'),
      'edited', ${jsonBool(row.edited)},
      'kind', 'assist'
    ))`
  }
  const pathPrefix = `$.${bucket}."`
  return sql`
    UPDATE cj_versions
    SET before_state = json_set(before_state, ${pathPrefix} || last_insert_rowid() || '"', json('null')),
        changes = ${changes}
    WHERE id = (
      SELECT MAX(id) FROM cj_versions
      WHERE user_id = ${userId} AND book_id = ${bookId} AND chapter_id = 0
    )
  `
}

const bookIdRef = (anchor) => {
  if (anchor === 'book') return sql`last_insert_rowid()`
  if (anchor === 'volume') return sql`(SELECT book_id FROM cj_volumes WHERE id = last_insert_rowid())`
  if (anchor === 'chapter') return sql`(SELECT book_id FROM cj_chapters WHERE id = last_insert_rowid())`
  return sql`(SELECT book_id FROM cj_cards WHERE id = last_insert_rowid())`
}

export const createdFromBatch = (rows, results) => {
  const created = { volumes: [], chapters: [], cards: [] }
  for (const row of rows || []) {
    const id = Number(results[row.at]?.lastInsertRowid) || 0
    if (row.type === 'volume') created.volumes.push({ id, title: row.title })
    else if (row.type === 'chapter') created.chapters.push({ id, number: row.number, title: row.title })
    else if (row.type === 'card') created.cards.push({ id, kind: row.kind, name: row.name })
  }
  return created
}

const pushChange = (details, row) => {
  if (!row.created && same(row.old, row.new)) return
  details.push(row)
}

const checkForeshadows = (fields, scope) => {
  if (!fields.foreshadows) return
  if (fields.foreshadows.some(id => !scope.foreshadowIds.has(id))) throw new CjError(400, '伏笔不存在或不属于这本书')
}

const checkVolume = (volumeId, scope) => {
  if (volumeId && !scope.volumeIds.has(volumeId)) throw new CjError(400, '分卷不存在')
}

// 先在内存里算完改动，再一次 batch。新行交给数据库自增，不预先占 id。任一语句失败，整批回滚。
export const planAssistApply = async ({ userId, chat, message, ids, all, ignoreIds, edits }) => {
  const suggestions = parseJson(message.suggestions, [])
  if (!Array.isArray(suggestions)) throw new CjError(400, '这条回复里没有修改建议')
  const ignore = new Set((ignoreIds || []).map(id => String(id)))
  for (const id of ignore) {
    const item = suggestions.find(row => row.id === id)
    if (!item) throw new CjError(400, '没有这条建议')
    if (item.status !== 'pending') throw new CjError(400, '这条建议已经处理过')
  }
  const wanted = new Set((ids || []).map(id => String(id)))
  const selected = suggestions.filter(item => {
    if (item.target_type === 'new_book' || ignore.has(item.id)) return false
    if (all) return item.status === 'pending'
    return wanted.has(item.id)
  })
  if (!selected.length && !ignore.size) throw new CjError(400, '没有要应用的建议')
  for (const item of selected) {
    if (item.status !== 'pending') throw new CjError(400, '这条建议已经处理过')
  }
  const scope = await loadAssistScope(userId, chat.book_id)
  if (!scope?.book) throw new CjError(404, '书不存在或无权访问')

  const planned = selected.map(item => {
    const edited = !!(edits && (edits[item.id] || edits[String(item.id)]))
    const fields = edited ? (edits[item.id] || edits[String(item.id)]) : item.fields
    let clean = null
    if (item.target_type === 'card') {
      const current = item.target_id === 'new' ? null : scope.cards.find(card => card.id === Number(item.target_id))
      const cardFields = cleanCardFields(fields, { creating: item.target_id === 'new', current })
      if (cardFields) clean = { target_type: 'card', target_id: item.target_id, fields: cardFields }
    } else {
      clean = sanitizeOne({ target_type: item.target_type, target_id: item.target_id, fields })
    }
    if (!clean) throw new CjError(400, '建议内容不正确')
    if (!ownsTarget({ ...item, target_id: clean.target_id }, scope)) throw new CjError(400, '目标不属于这本书')
    checkForeshadows(clean.fields, scope)
    checkVolume(clean.fields.volume_id, scope)
    return { ...item, fields: clean.fields, edited }
  })

  // 负数只用来在这一次计划里区分新行，不会写进表。
  let tempId = 0
  const allocTemp = () => {
    tempId -= 1
    return tempId
  }
  const numberOwner = new Map(scope.chapters.map(item => [item.number, item.id]))
  const allocNumber = (preferred, selfId) => {
    const release = () => {
      if (!selfId) return
      for (const [number, owner] of numberOwner) if (owner === selfId) numberOwner.delete(number)
    }
    if (preferred) {
      const owner = numberOwner.get(preferred)
      if (owner && owner !== selfId) throw new CjError(400, `第 ${preferred} 章已存在`)
      release()
      numberOwner.set(preferred, selfId || `new-${preferred}`)
      return preferred
    }
    release()
    let cursor = 0
    do { cursor += 1 } while (numberOwner.has(cursor))
    numberOwner.set(cursor, selfId || `new-${cursor}`)
    return cursor
  }

  const cardNames = new Map()
  for (const card of scope.cards) cardNames.set(`${card.kind}:${card.name}`, card.id)
  const claimCardName = (kind, name, selfId) => {
    if (typeof selfId === 'number') {
      for (const [key, owner] of cardNames) if (owner === selfId) cardNames.delete(key)
    }
    const owner = cardNames.get(`${kind}:${name}`)
    if (owner && owner !== selfId) throw new CjError(400, `「${name}」已经有卡片了`)
    cardNames.set(`${kind}:${name}`, selfId)
  }

  const bookNext = bookSnapshot(scope.book)
  let bookTouched = false
  const volumeState = new Map(scope.volumes.map(item => [item.id, volumeSnapshot(item)]))
  const chapterState = new Map(scope.chapters.map(item => [item.id, chapterSnapshot(item)]))
  const cardState = new Map(scope.cards.map(item => [item.id, cardSnapshot(item)]))
  const before = { books: {}, volumes: {}, chapters: {}, cards: {} }
  const details = []
  const created = { volumes: [], chapters: [], cards: [] }
  let volumeSort = scope.volumes.reduce((max, item) => Math.max(max, item.sort || 0), 0)
  const defaultVolumeId = () => {
    if (chat.target_type === 'volume' && scope.volumeIds.has(chat.target_id)) return chat.target_id
    if (chat.target_type === 'chapter') return scope.chapters.find(item => item.id === chat.target_id)?.volume_id || null
    return scope.volumes[0]?.id || null
  }

  const remember = (bucket, id, snapshot) => {
    const key = String(id)
    if (Object.prototype.hasOwnProperty.call(before[bucket], key)) return
    before[bucket][key] = snapshot
  }

  for (const item of planned) {
    if (item.target_type === 'book') {
      remember('books', scope.book.id, bookSnapshot(scope.book))
      for (const [key, value] of Object.entries(item.fields)) {
        pushChange(details, {
          target_type: 'book', target_id: scope.book.id, target_name: bookNext.title, field: key,
          field_label: suggestionChanges('book', { [key]: value })[0]?.label || key,
          old: displayValue(bookNext[key]), new: displayValue(value), created: false, edited: item.edited, kind: 'assist'
        })
        bookNext[key] = value
        bookTouched = true
      }
      continue
    }
    if (item.target_type === 'volume' && item.target_id !== 'new') {
      const current = volumeState.get(item.target_id)
      remember('volumes', item.target_id, { ...current })
      for (const [key, value] of Object.entries(item.fields)) {
        pushChange(details, {
          target_type: 'volume', target_id: item.target_id, target_name: current.title, field: key,
          field_label: suggestionChanges('volume', { [key]: value })[0]?.label || key,
          old: displayValue(current[key]), new: displayValue(value), created: false, edited: item.edited, kind: 'assist'
        })
        current[key] = value
      }
      continue
    }
    if (item.target_type === 'volume') {
      const id = allocTemp()
      volumeSort += 1
      const row = { sort: volumeSort, title: item.fields.title || `卷${volumeSort}`, goal: item.fields.goal || '', outline: item.fields.outline || '' }
      volumeState.set(id, row)
      created.volumes.push({ id, title: row.title })
      for (const [key, value] of Object.entries(row)) {
        if (key === 'sort') continue
        details.push({
          target_type: 'volume', target_id: id, target_name: row.title, field: key,
          field_label: suggestionChanges('volume', { [key]: value })[0]?.label || key,
          old: '', new: displayValue(value), created: true, edited: item.edited, kind: 'assist'
        })
      }
      continue
    }
    if (item.target_type === 'chapter' && item.target_id !== 'new') {
      const current = chapterState.get(item.target_id)
      remember('chapters', item.target_id, { ...current })
      const next = { ...current }
      if (item.fields.number) next.number = allocNumber(item.fields.number, item.target_id)
      if (item.fields.volume_id) next.volume_id = item.fields.volume_id
      for (const key of ['title', 'goal', 'conflict', 'payoff', 'hook', 'target_words']) {
        if (item.fields[key] !== undefined) next[key] = item.fields[key]
      }
      if (item.fields.characters) next.characters = JSON.stringify(item.fields.characters)
      if (item.fields.foreshadows) next.foreshadows = JSON.stringify(item.fields.foreshadows)
      for (const key of Object.keys(item.fields)) {
        pushChange(details, {
          target_type: 'chapter', target_id: item.target_id, target_name: `第 ${current.number} 章 ${current.title}`, field: key,
          field_label: suggestionChanges('chapter', { [key]: item.fields[key] })[0]?.label || key,
          old: displayValue(key === 'characters' || key === 'foreshadows' ? asList(current[key]) : current[key]),
          new: displayValue(item.fields[key]), created: false, edited: item.edited, kind: 'assist'
        })
      }
      chapterState.set(item.target_id, next)
      continue
    }
    if (item.target_type === 'chapter') {
      const id = allocTemp()
      const number = allocNumber(item.fields.number, null)
      const row = {
        volume_id: item.fields.volume_id || defaultVolumeId(),
        number,
        title: item.fields.title || `第 ${number} 章`,
        goal: item.fields.goal || '',
        conflict: item.fields.conflict || '',
        payoff: item.fields.payoff || '',
        hook: item.fields.hook || '',
        characters: JSON.stringify(item.fields.characters || []),
        foreshadows: JSON.stringify(item.fields.foreshadows || []),
        target_words: item.fields.target_words ?? null
      }
      if (row.volume_id) checkVolume(row.volume_id, scope)
      chapterState.set(id, row)
      created.chapters.push({ id, number, title: row.title })
      details.push({
        target_type: 'chapter', target_id: id, target_name: `第 ${number} 章 ${row.title}`, field: 'created',
        field_label: '细纲', old: '', new: [row.goal, row.conflict, row.payoff, row.hook].filter(Boolean).join(' / ') || row.title,
        created: true, edited: item.edited, kind: 'assist'
      })
      continue
    }
    if (item.target_type === 'card' && item.target_id !== 'new') {
      const current = cardState.get(item.target_id)
      if (item.fields.kind && item.fields.kind !== current.kind) throw new CjError(400, '不能改卡片类型')
      const input = readCardInput({
        ...(item.fields.name !== undefined ? { name: item.fields.name } : {}),
        ...(item.fields.aliases !== undefined ? { aliases: item.fields.aliases } : {}),
        ...(item.fields.category !== undefined ? { category: item.fields.category } : {}),
        data: item.fields.data || {}
      }, { ...current, data: current.data || {} })
      claimCardName(current.kind, input.name, item.target_id)
      remember('cards', item.target_id, cardSnapshot(current))
      const name = current.name
      for (const [key, value] of Object.entries(item.fields)) {
        if (key === 'data' || key === 'kind') continue
        pushChange(details, {
          target_type: current.kind, target_id: item.target_id, target_name: name, field: key,
          field_label: suggestionChanges('card', { [key]: value })[0]?.label || key,
          old: displayValue(current[key]), new: displayValue(input[key]), created: false, edited: item.edited, kind: 'assist'
        })
      }
      for (const [key, value] of Object.entries(item.fields.data || {})) {
        pushChange(details, {
          target_type: current.kind, target_id: item.target_id, target_name: name, field: key,
          field_label: suggestionChanges('card', { [key]: value })[0]?.label || key,
          old: displayValue(current.data?.[key]), new: displayValue(input.data?.[key]), created: false, edited: item.edited, kind: 'assist'
        })
      }
      cardState.set(item.target_id, { ...current, name: input.name, aliases: input.aliases, category: input.category, data: input.data })
      continue
    }
    if (item.target_type === 'card') {
      const id = allocTemp()
      const input = readCardInput(item.fields, { kind: item.fields.kind })
      if (input.kind === 'character') {
        if (input.data.alive === undefined) input.data.alive = '是'
        if (input.data.present === undefined) input.data.present = '是'
      }
      claimCardName(input.kind, input.name, id)
      const row = { kind: input.kind, name: input.name, aliases: input.aliases || '', category: input.category || '', data: input.data || {} }
      cardState.set(id, row)
      created.cards.push({ id, kind: row.kind, name: row.name })
      details.push({
        target_type: row.kind, target_id: id, target_name: row.name, field: 'created',
        field_label: row.kind === 'setting' ? (row.category || '设定') : '新人物',
        old: '', new: row.kind === 'setting' ? (row.data.content || row.name) : (row.data.role || row.name),
        created: true, edited: item.edited, kind: 'assist'
      })
    }
  }

  const statements = []
  const newRows = []
  if (bookTouched) {
    statements.push(sql`
      UPDATE cj_books SET title = ${bookNext.title}, chapter_words = ${bookNext.chapter_words},
        foreshadow_remind = ${bookNext.foreshadow_remind}, budget = ${bookNext.budget},
        world = ${bookNext.world}, outline = ${bookNext.outline}, updated_at = datetime('now', '+8 hours')
      WHERE id = ${scope.book.id} AND user_id = ${userId}
    `)
  }
  for (const [id, row] of volumeState) {
    if (id < 0 || !before.volumes[String(id)]) continue
    statements.push(sql`
      UPDATE cj_volumes SET title = ${row.title}, goal = ${row.goal}, outline = ${row.outline}
      WHERE id = ${id} AND book_id = ${scope.book.id} AND user_id = ${userId}
    `)
  }
  for (const [id, row] of chapterState) {
    if (id < 0 || !before.chapters[String(id)]) continue
    statements.push(sql`
      UPDATE cj_chapters SET volume_id = ${row.volume_id}, number = ${row.number}, title = ${row.title},
        goal = ${row.goal}, conflict = ${row.conflict}, payoff = ${row.payoff}, hook = ${row.hook},
        characters = ${row.characters}, foreshadows = ${row.foreshadows}, target_words = ${row.target_words},
        updated_at = datetime('now', '+8 hours')
      WHERE id = ${id} AND book_id = ${scope.book.id} AND user_id = ${userId}
    `)
  }
  for (const [id, row] of cardState) {
    if (id < 0 || !before.cards[String(id)]) continue
    const data = JSON.stringify(row.data || {})
    statements.push(sql`
      UPDATE cj_cards SET name = ${row.name}, aliases = ${row.aliases}, category = ${row.category},
        data = ${data}, updated_at = datetime('now', '+8 hours')
      WHERE id = ${id} AND book_id = ${scope.book.id} AND user_id = ${userId}
    `)
  }

  const appliedIds = new Set(planned.map(item => item.id))
  const nextSuggestions = suggestions.map(item => {
    if (appliedIds.has(item.id)) return { ...item, status: 'applied' }
    if (ignore.has(item.id)) return { ...item, status: 'ignored' }
    return item
  })
  const storedDetails = details.filter(item => !item.created)
  const hasNew = created.volumes.length + created.chapters.length + created.cards.length > 0
  if (storedDetails.length || hasNew) {
    const label = `AI 修改：${(chat.title || '对话').slice(0, 24)}`
    statements.push(sql`
      INSERT INTO cj_versions (user_id, book_id, chapter_id, chapter_number, label, content, changes, before_state, after_state, stats)
      VALUES (${userId}, ${scope.book.id}, 0, 0, ${label}, '', ${JSON.stringify(storedDetails)}, ${JSON.stringify(before)}, '{}', ${JSON.stringify({ source: 'assist', chat_id: chat.id, message_id: message.id })})
    `)
  }
  const pushNew = (meta, insert, bucket, tempId) => {
    newRows.push({ at: statements.length, ...meta })
    statements.push(insert)
    const mine = details.filter(item => item.created && item.target_id === tempId)
    statements.push(noteNewRow(userId, scope.book.id, bucket, mine))
  }
  for (const item of created.volumes) {
    const row = volumeState.get(item.id)
    pushNew({ type: 'volume', title: row.title }, sql`
      INSERT INTO cj_volumes (user_id, book_id, sort, title, goal, outline)
      VALUES (${userId}, ${scope.book.id}, ${row.sort}, ${row.title}, ${row.goal}, ${row.outline})
    `, 'volumes', item.id)
  }
  for (const item of created.chapters) {
    const row = chapterState.get(item.id)
    pushNew({ type: 'chapter', number: row.number, title: row.title }, sql`
      INSERT INTO cj_chapters (user_id, book_id, volume_id, number, title, goal, conflict, payoff, hook, characters, foreshadows, target_words)
      VALUES (${userId}, ${scope.book.id}, ${row.volume_id}, ${row.number}, ${row.title}, ${row.goal}, ${row.conflict}, ${row.payoff}, ${row.hook}, ${row.characters}, ${row.foreshadows}, ${row.target_words})
    `, 'chapters', item.id)
  }
  for (const item of created.cards) {
    const row = cardState.get(item.id)
    const data = JSON.stringify(row.data || {})
    pushNew({ type: 'card', kind: row.kind, name: row.name }, sql`
      INSERT INTO cj_cards (user_id, book_id, kind, name, aliases, category, data)
      VALUES (${userId}, ${scope.book.id}, ${row.kind}, ${row.name}, ${row.aliases}, ${row.category}, ${data})
    `, 'cards', item.id)
  }
  if (!bookTouched && (storedDetails.length || hasNew)) {
    statements.push(sql`UPDATE cj_books SET updated_at = datetime('now', '+8 hours') WHERE id = ${scope.book.id} AND user_id = ${userId}`)
  }
  statements.push(sql`
    UPDATE cj_ai_messages SET suggestions = ${JSON.stringify(nextSuggestions)}
    WHERE id = ${message.id} AND chat_id = ${chat.id} AND user_id = ${userId}
  `)
  statements.push(sql`UPDATE cj_ai_chats SET updated_at = datetime('now', '+8 hours') WHERE id = ${chat.id} AND user_id = ${userId}`)
  return { statements, newRows, suggestions: nextSuggestions }
}

const nextNumbers = (chapters) => {
  const used = new Set()
  return chapters.map(chapter => {
    if (chapter.number) {
      if (used.has(chapter.number)) throw new CjError(400, `第 ${chapter.number} 章已存在`)
      used.add(chapter.number)
      return chapter.number
    }
    let cursor = Math.max(0, ...used, 0)
    do { cursor += 1 } while (used.has(cursor))
    used.add(cursor)
    return cursor
  })
}

export const planCreateBook = async ({ userId, chat, message, suggestionId, plan }) => {
  if (chat.target_type !== 'new_book') throw new CjError(400, '这段对话不是新书构思')
  if (chat.book_id) throw new CjError(409, '这个构思已经建过书了')
  const suggestions = parseJson(message.suggestions, [])
  const current = suggestions.find(item => item.id === suggestionId)
  if (!current || current.target_type !== 'new_book') throw new CjError(400, '没有这条建书建议')
  if (current.status === 'applied') throw new CjError(400, '这条建议已经用过了')
  const fields = cleanNewBookFields(plan || current.fields)
  if (!fields?.title) throw new CjError(400, '请填写书名')
  const clash = await db.get(sql`SELECT id FROM cj_books WHERE user_id = ${userId} AND title = ${fields.title}`)
  if (clash) throw new CjError(400, '已经有同名的书了')

  let tempId = 0
  const allocTemp = () => {
    tempId -= 1
    return tempId
  }
  const volumes = fields.volumes?.length ? fields.volumes : [{ title: '卷一', goal: '', outline: '', chapters: [] }]
  const flatChapters = []
  const volumeRows = volumes.map((volume, index) => {
    const id = allocTemp()
    const chapters = (volume.chapters || []).map(chapter => ({ ...chapter, volume_id: id }))
    flatChapters.push(...chapters)
    return { id, sort: index + 1, title: volume.title, goal: volume.goal || '', outline: volume.outline || '' }
  })
  const numbers = nextNumbers(flatChapters)
  const chapterRows = flatChapters.map((chapter, index) => {
    const number = numbers[index]
    return {
      volume_id: chapter.volume_id,
      number,
      title: chapter.title || `第 ${number} 章`,
      goal: chapter.goal || '',
      conflict: chapter.conflict || '',
      payoff: chapter.payoff || '',
      hook: chapter.hook || '',
      characters: JSON.stringify(chapter.characters || []),
      foreshadows: JSON.stringify(chapter.foreshadows || []),
      target_words: chapter.target_words ?? null
    }
  })
  const cardRows = (fields.cards || []).map(card => ({ ...card, data: card.data || {} }))
  const nextSuggestions = suggestions.map(item => item.id === current.id ? { ...item, fields, status: 'applied' } : item)
  const statements = []
  const newRows = []
  const pushRow = (meta, query) => {
    newRows.push({ at: statements.length, ...meta })
    statements.push(query)
  }
  pushRow({ type: 'book' }, sql`
    INSERT INTO cj_books (user_id, title, chapter_words, foreshadow_remind, budget, world, outline)
    VALUES (${userId}, ${fields.title}, ${fields.chapter_words || 2500}, ${fields.foreshadow_remind ?? 3}, ${fields.budget ?? 1}, ${fields.world || DEFAULT_WORLD}, ${fields.outline || DEFAULT_OUTLINE})
  `)
  let anchor = 'book'
  for (const volume of volumeRows) {
    pushRow({ type: 'volume', title: volume.title }, sql`
      INSERT INTO cj_volumes (user_id, book_id, sort, title, goal, outline)
      VALUES (${userId}, ${bookIdRef(anchor)}, ${volume.sort}, ${volume.title}, ${volume.goal}, ${volume.outline})
    `)
    anchor = 'volume'
    for (const chapter of chapterRows.filter(item => item.volume_id === volume.id)) {
      const volumeRef = anchor === 'volume'
        ? sql`last_insert_rowid()`
        : sql`(SELECT volume_id FROM cj_chapters WHERE id = last_insert_rowid())`
      pushRow({ type: 'chapter', number: chapter.number, title: chapter.title }, sql`
        INSERT INTO cj_chapters (user_id, book_id, volume_id, number, title, goal, conflict, payoff, hook, characters, foreshadows, target_words)
        VALUES (${userId}, ${bookIdRef(anchor)}, ${volumeRef}, ${chapter.number}, ${chapter.title}, ${chapter.goal}, ${chapter.conflict}, ${chapter.payoff}, ${chapter.hook}, ${chapter.characters}, ${chapter.foreshadows}, ${chapter.target_words})
      `)
      anchor = 'chapter'
    }
  }
  for (const card of cardRows) {
    pushRow({ type: 'card', kind: card.kind, name: card.name }, sql`
      INSERT INTO cj_cards (user_id, book_id, kind, name, aliases, category, data)
      VALUES (${userId}, ${bookIdRef(anchor)}, ${card.kind}, ${card.name}, ${card.aliases || ''}, ${card.category || ''}, ${JSON.stringify(card.data || {})})
    `)
    anchor = 'card'
  }
  const bookRef = bookIdRef(anchor)
  statements.push(sql`
    UPDATE cj_ai_chats SET book_id = ${bookRef}, updated_at = datetime('now', '+8 hours')
    WHERE id = ${chat.id} AND user_id = ${userId}
  `)
  statements.push(sql`
    UPDATE cj_ai_messages SET suggestions = ${JSON.stringify(nextSuggestions)}
    WHERE id = ${message.id} AND chat_id = ${chat.id} AND user_id = ${userId}
  `)
  const label = `AI 建书：${fields.title}`.slice(0, 40)
  const stats = JSON.stringify({ source: 'assist', chat_id: chat.id, message_id: message.id })
  statements.push(sql`
    INSERT INTO cj_versions (user_id, book_id, chapter_id, chapter_number, label, content, changes, before_state, after_state, stats)
    SELECT ${userId}, src.book_id, 0, 0, ${label}, '',
      (
        SELECT json_group_array(json(item)) FROM (
          SELECT json_object(
            'target_type', 'book', 'target_id', b.id, 'target_name', b.title,
            'field', 'title', 'field_label', '书名', 'old', '', 'new', b.title,
            'created', json('true'), 'kind', 'assist'
          ) AS item
          FROM cj_books b WHERE b.id = src.book_id
          UNION ALL
          SELECT json_object(
            'target_type', 'volume', 'target_id', v.id, 'target_name', v.title,
            'field', 'created', 'field_label', '分卷', 'old', '',
            'new', CASE WHEN v.goal != '' THEN v.goal ELSE v.title END,
            'created', json('true'), 'kind', 'assist'
          )
          FROM cj_volumes v WHERE v.book_id = src.book_id
          UNION ALL
          SELECT json_object(
            'target_type', 'chapter', 'target_id', c.id,
            'target_name', '第 ' || c.number || ' 章 ' || c.title,
            'field', 'created', 'field_label', '细纲', 'old', '',
            'new', CASE WHEN c.goal != '' THEN c.goal ELSE c.title END,
            'created', json('true'), 'kind', 'assist'
          )
          FROM cj_chapters c WHERE c.book_id = src.book_id
          UNION ALL
          SELECT json_object(
            'target_type', k.kind, 'target_id', k.id, 'target_name', k.name,
            'field', 'created',
            'field_label', CASE WHEN k.kind = 'setting' THEN CASE WHEN k.category != '' THEN k.category ELSE '设定' END ELSE '新人物' END,
            'old', '', 'new', k.name,
            'created', json('true'), 'kind', 'assist'
          )
          FROM cj_cards k WHERE k.book_id = src.book_id
        )
      ),
      json_object(
        'books', json('{"' || src.book_id || '":null}'),
        'volumes', json('{}'),
        'chapters', json('{}'),
        'cards', json('{}')
      ),
      '{}', ${stats}
    FROM (SELECT ${bookRef} AS book_id) src
  `)
  return { statements, bookAt: 0, newRows, suggestions: nextSuggestions }
}

const bookWasCreated = (before, bookId) => Object.prototype.hasOwnProperty.call(before.books || {}, String(bookId)) && (before.books || {})[String(bookId)] == null

export const revertAssistStatements = (userId, version) => {
  const before = parseJson(version.before_state, {})
  const statements = []
  const bookId = version.book_id
  if (bookWasCreated(before, bookId)) {
    statements.push(sql`DELETE FROM cj_chapters WHERE book_id = ${bookId} AND user_id = ${userId}`)
    statements.push(sql`DELETE FROM cj_cards WHERE book_id = ${bookId} AND user_id = ${userId}`)
    statements.push(sql`DELETE FROM cj_foreshadows WHERE book_id = ${bookId} AND user_id = ${userId}`)
    statements.push(sql`DELETE FROM cj_volumes WHERE book_id = ${bookId} AND user_id = ${userId}`)
    statements.push(sql`DELETE FROM cj_books WHERE id = ${bookId} AND user_id = ${userId}`)
    statements.push(sql`
      UPDATE cj_ai_chats SET book_id = NULL, updated_at = datetime('now', '+8 hours')
      WHERE book_id = ${bookId} AND user_id = ${userId} AND target_type = 'new_book'
    `)
  } else {
    const book = before.books?.[String(bookId)]
    if (book) {
      statements.push(sql`
        UPDATE cj_books SET title = ${book.title}, chapter_words = ${book.chapter_words}, foreshadow_remind = ${book.foreshadow_remind},
          budget = ${book.budget}, world = ${book.world}, outline = ${book.outline}, updated_at = datetime('now', '+8 hours')
        WHERE id = ${bookId} AND user_id = ${userId}
      `)
    }
    for (const [id, snapshot] of Object.entries(before.volumes || {})) {
      if (!snapshot) statements.push(sql`DELETE FROM cj_volumes WHERE id = ${Number(id)} AND book_id = ${bookId} AND user_id = ${userId}`)
      else statements.push(sql`
        UPDATE cj_volumes SET sort = ${snapshot.sort}, title = ${snapshot.title}, goal = ${snapshot.goal}, outline = ${snapshot.outline}
        WHERE id = ${Number(id)} AND book_id = ${bookId} AND user_id = ${userId}
      `)
    }
    for (const [id, snapshot] of Object.entries(before.chapters || {})) {
      if (!snapshot) statements.push(sql`DELETE FROM cj_chapters WHERE id = ${Number(id)} AND book_id = ${bookId} AND user_id = ${userId}`)
      else statements.push(sql`
        UPDATE cj_chapters SET volume_id = ${snapshot.volume_id}, number = ${snapshot.number}, title = ${snapshot.title},
          goal = ${snapshot.goal}, conflict = ${snapshot.conflict}, payoff = ${snapshot.payoff}, hook = ${snapshot.hook},
          characters = ${snapshot.characters}, foreshadows = ${snapshot.foreshadows}, target_words = ${snapshot.target_words},
          updated_at = datetime('now', '+8 hours')
        WHERE id = ${Number(id)} AND book_id = ${bookId} AND user_id = ${userId}
      `)
    }
    for (const [id, snapshot] of Object.entries(before.cards || {})) {
      statements.push(restoreCardStatement(userId, bookId, Number(id), snapshot))
    }
    statements.push(sql`UPDATE cj_books SET updated_at = datetime('now', '+8 hours') WHERE id = ${bookId} AND user_id = ${userId}`)
  }
  statements.push(sql`UPDATE cj_versions SET reverted = 1, reverted_at = datetime('now', '+8 hours') WHERE id = ${version.id} AND user_id = ${userId}`)
  return statements
}
