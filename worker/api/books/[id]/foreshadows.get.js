import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, formatForeshadow, getBook, paramId } from '../../../lib/common.js'
import { currentChapterNumber } from '../../../lib/views.js'

// GET /api/changjuan/books/:id/foreshadows - 伏笔追踪表与统计
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const current = (await currentChapterNumber(book.id, auth.id))
  const remind = Number(book.foreshadow_remind) || 0
  const list = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY id`)).map(formatForeshadow).map(item => {
    let state = item.status
    if (item.status === 'open' && item.planned_chapter) {
      if (item.planned_chapter < current) state = 'overdue'
      else if (item.planned_chapter <= current + remind) state = 'due_soon'
    }
    return { ...item, state, remaining: item.planned_chapter ? item.planned_chapter - current : null }
  })
  const resolved = list.filter(item => item.status === 'resolved').length
  const overdue = list.filter(item => item.state === 'overdue').length
  const maxChapter = (await db.get(sql`SELECT COALESCE(MAX(number), 0) AS number FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${auth.id}`)).number
  return {
    code: 200,
    data: {
      list,
      current_chapter: current,
      max_chapter: Math.max(maxChapter, ...list.map(item => item.planned_chapter || 0), current, 10),
      remind,
      stats: {
        overdue,
        due_soon: list.filter(item => item.state === 'due_soon').length,
        open: list.filter(item => item.status === 'open').length,
        resolved,
        rate: resolved + overdue ? resolved / (resolved + overdue) : null
      }
    }
  }
})
