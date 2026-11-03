import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, getBook, getChapter, paramId } from '../../../lib/common.js'
import { applyChanges } from '../../../lib/memory.js'
import { generateSummary } from '../../../lib/workflow.js'
import { chapterCost, chapterDetail } from '../../../lib/views.js'

// POST /api/changjuan/chapters/:id/confirm - 确认记忆库改动：应用已接受的改动、保存可回滚的版本、生成章节摘要
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  const book = (await getBook(auth.id, chapter.book_id))
  const detail = (await chapterDetail(chapter))
  if (chapter.status === 'confirmed') throw new CjError(409, '本章已经确认过了')
  if (!detail.can_extract) throw new CjError(409, '请先完成一致性检查，并处理掉所有"必须改"的问题（正文改过后需要重新检查）')
  const pending = detail.changes.filter(item => item.decision === 'pending')
  if (pending.length) throw new CjError(409, `还有 ${pending.length} 条改动没有确认`)

  const accepted = detail.changes.filter(item => item.decision === 'accepted')
  const { before, after, details, statements } = (await applyChanges({ userId: auth.id, book, chapter, changes: accepted }))
  let stats = {
    accepted: accepted.filter(item => !item.edited).length,
    edited: accepted.filter(item => item.edited).length,
    rejected: detail.changes.filter(item => item.decision === 'rejected').length,
    auto: accepted.filter(item => item.kind === 'state').length
  }
  const versionIndex = statements.length
  statements.push(sql`
    INSERT INTO cj_versions (user_id, book_id, chapter_id, chapter_number, label, content, changes, before_state, after_state, stats)
    VALUES (${auth.id}, ${book.id}, ${chapter.id}, ${chapter.number}, ${`第 ${chapter.number} 章确认`}, ${chapter.content}, ${JSON.stringify(details)}, ${JSON.stringify(before)}, ${JSON.stringify(after)}, ${JSON.stringify(stats)})
  `)
  statements.push(sql`UPDATE cj_chapters SET status = 'confirmed', confirmed_at = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ${chapter.id} AND user_id = ${auth.id}`)
  statements.push(sql`UPDATE cj_books SET updated_at = datetime('now', '+8 hours') WHERE id = ${book.id} AND user_id = ${auth.id}`)
  const results = (await db.batch(statements))
  const versionId = Number(results[versionIndex].lastInsertRowid)

  // A failed summary does not undo the confirmation. The client can retry.
  let summaryError = ''
  try {
    const summary = await (await generateSummary(auth.id, chapter))
    ;(await db.run(sql`UPDATE cj_chapters SET summary = ${summary} WHERE id = ${chapter.id} AND user_id = ${auth.id}`))
  } catch (err) {
    summaryError = err.message
  }
  const version = (await db.get(sql`SELECT stats FROM cj_versions WHERE id = ${versionId} AND user_id = ${auth.id}`))
  stats = { ...JSON.parse(version.stats), cost: (await chapterCost(chapter.id, auth.id)) }
  ;(await db.run(sql`UPDATE cj_versions SET stats = ${JSON.stringify(stats)} WHERE id = ${versionId} AND user_id = ${auth.id}`))
  return { code: 200, message: '已确认', data: { version_id: versionId, summary_error: summaryError, chapter: (await chapterDetail((await getChapter(auth.id, chapter.id)))) } }
})
