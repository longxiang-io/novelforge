import { cjHandler, getBook, paramId, queryOf } from '../../../lib/common.js'
import { listCards } from '../../../lib/memory.js'
import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'

// GET /api/changjuan/books/:id/cards?kind=character|setting - 记忆库卡片，附摘要列表
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const kind = ['character', 'setting'].includes(queryOf(event).kind) ? queryOf(event).kind : ''
  const pending = (await db.all(sql`
    SELECT c.target_name, c.field, c.new_value, ch.number FROM cj_changes c JOIN cj_chapters ch ON ch.id = c.chapter_id AND ch.user_id = ${auth.id}
    WHERE c.book_id = ${book.id} AND c.user_id = ${auth.id} AND ch.status != 'confirmed' AND c.kind IN ('state', 'key_state') AND c.decision != 'rejected'
  `))
  const summaries = (await db.all(sql`SELECT id, number, title, summary FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${auth.id} AND summary != '' ORDER BY number`))
  return { code: 200, data: { cards: (await listCards(book.id, kind, auth.id)), pending, summaries } }
})
