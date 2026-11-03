import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, getBook, paramId, parseJson } from '../../../lib/common.js'

// GET /api/changjuan/books/:id/versions - 版本历史（每章确认一个版本）
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const rows = (await db.all(sql`SELECT id, chapter_id, chapter_number, label, changes, stats, reverted, reverted_at, created_at FROM cj_versions WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY id DESC`))
  const latestActive = rows.find(row => !row.reverted)?.id || null
  const data = rows.map(row => {
    const changes = parseJson(row.changes, [])
    return {
      id: row.id,
      chapter_id: row.chapter_id,
      chapter_number: row.chapter_number,
      label: row.label,
      created_at: row.created_at,
      reverted: row.reverted,
      reverted_at: row.reverted_at,
      card_count: new Set(changes.map(item => `${item.target_type}:${item.target_id}`)).size,
      stats: parseJson(row.stats, {}),
      can_revert: row.id === latestActive
    }
  })
  return { code: 200, data }
})
