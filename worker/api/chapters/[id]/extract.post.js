import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, formatForeshadow, getBook, getChapter, paramId, readBody, splitParagraphs } from '../../../lib/common.js'
import { findCardByName, isKeyField, listCards, normalizeField, readField } from '../../../lib/memory.js'
import { locateParagraph } from '../../../lib/checker.js'
import { buildExtractMessages } from '../../../lib/prompts.js'
import { chatCompletion, parseModelJson } from '../../../lib/llm.js'
import { chapterDetail } from '../../../lib/views.js'

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max)

// POST /api/changjuan/chapters/:id/extract - 提取本章的记忆库改动并分两类：
// 普通状态变化默认接受；关键状态（死亡/离场/境界）、新人物、新设定、新伏笔、伏笔回收需逐条确认
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  const book = (await getBook(auth.id, chapter.book_id))
  const body = await readBody(event)
  const detail = (await chapterDetail(chapter))
  if (chapter.status === 'confirmed') throw new CjError(409, '本章已确认')
  if (!detail.can_extract) throw new CjError(409, '请先完成一致性检查，并处理掉所有"必须改"的问题')

  const characters = (await listCards(book.id, 'character', auth.id))
  const changes = []
  // 不依赖模型：本章出现的人物，更新"最后出场"
  for (const card of characters) {
    const names = [card.name, ...String(card.aliases || '').split(/[,，、\s]+/)].filter(item => item && item.length >= 2)
    if (!names.some(name => chapter.content.includes(name))) continue
    const old = readField(card.data, 'last_seen')
    if (old !== String(chapter.number)) changes.push({ kind: 'state', target_name: card.name, field: 'last_seen', old_value: old, new_value: String(chapter.number), quote: '', paragraph: null, payload: {}, decision: 'accepted' })
  }

  let modelError = null
  if (!body.skip_model) {
    const paragraphs = splitParagraphs(chapter.content)
    const settings = (await listCards(book.id, 'setting', auth.id))
    const foreshadows = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${auth.id} AND status = 'open' ORDER BY id`)).map(formatForeshadow)
    const result = await chatCompletion({
      task: 'extract',
      messages: buildExtractMessages({ chapter, characters, settings, foreshadows, paragraphs }),
      userId: auth.id,
      bookId: book.id,
      chapterId: chapter.id,
      temperature: 0.1
    })
    const json = parseModelJson(result.text)
    const locate = (quote, hint) => locateParagraph(paragraphs, quote, hint)

    for (const item of Array.isArray(json.state_changes) ? json.state_changes : []) {
      const name = text(item?.character, 60)
      const field = normalizeField(item?.field)
      const value = text(item?.new)
      if (!name || !field || !value || field === 'last_seen') continue
      const card = findCardByName(characters, name)
      const old = card ? readField(card.data, field) : ''
      if (old === value) continue
      const key = isKeyField(field)
      changes.push({ kind: key ? 'key_state' : 'state', target_name: card?.name || name, field, old_value: old, new_value: value, quote: text(item.quote, 300), paragraph: locate(item.quote, item.paragraph), payload: {}, decision: key ? 'pending' : 'accepted' })
    }
    for (const item of Array.isArray(json.new_characters) ? json.new_characters : []) {
      const name = text(item?.name, 60)
      if (!name || findCardByName(characters, name)) continue
      changes.push({ kind: 'new_character', target_name: name, field: '', old_value: '', new_value: text(item.role, 200), quote: text(item.quote, 300), paragraph: locate(item.quote), payload: { name, data: { role: text(item.role, 200), appearance: text(item.appearance), personality: text(item.personality) } }, decision: 'pending' })
    }
    for (const item of Array.isArray(json.new_settings) ? json.new_settings : []) {
      const name = text(item?.name, 60)
      const content = text(item?.content, 1000)
      if (!name || !content) continue
      changes.push({ kind: 'new_setting', target_name: name, field: text(item.category, 20), old_value: '', new_value: content, quote: text(item.quote, 300), paragraph: locate(item.quote), payload: { name, category: text(item.category, 20) }, decision: 'pending' })
    }
    for (const item of Array.isArray(json.new_foreshadows) ? json.new_foreshadows : []) {
      const content = text(item?.content, 500)
      if (!content) continue
      const planned = Number.parseInt(item.planned_chapter, 10)
      changes.push({ kind: 'new_foreshadow', target_name: '', field: '', old_value: '', new_value: content, quote: text(item.quote, 300), paragraph: locate(item.quote), payload: { characters: (Array.isArray(item.characters) ? item.characters : []).map(name => text(name, 60)).filter(Boolean), planned_chapter: planned > chapter.number ? planned : null }, decision: 'pending' })
    }
    for (const item of Array.isArray(json.resolved_foreshadows) ? json.resolved_foreshadows : []) {
      const code = text(item?.code, 20).toUpperCase()
      const target = foreshadows.find(row => row.code === code)
      if (!target) continue
      changes.push({ kind: 'resolve_foreshadow', target_name: code, field: 'status', old_value: '未回收', new_value: '已回收', quote: text(item.quote, 300), paragraph: locate(item.quote), payload: { foreshadow_id: target.id, content: target.content }, decision: 'pending' })
    }
  } else {
    modelError = '已跳过模型提取，只记录了人物最后出场章节'
  }

  ;(await db.batch([
    sql`DELETE FROM cj_changes WHERE chapter_id = ${chapter.id} AND user_id = ${auth.id}`,
    ...changes.map(change => sql`
      INSERT INTO cj_changes (user_id, book_id, chapter_id, kind, target_name, field, old_value, new_value, quote, paragraph, payload, decision)
      VALUES (${auth.id}, ${book.id}, ${chapter.id}, ${change.kind}, ${change.target_name}, ${change.field}, ${change.old_value}, ${change.new_value}, ${change.quote}, ${change.paragraph}, ${JSON.stringify(change.payload)}, ${change.decision})
    `)
  ]))
  return { code: 200, message: modelError || '已提取改动', data: (await chapterDetail((await getChapter(auth.id, chapter.id)))) }
})
