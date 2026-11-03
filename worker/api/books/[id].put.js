import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, cleanText, getBook, paramId, readBody, toInt } from '../../lib/common.js'

// PUT /api/changjuan/books/:id - 修改书名、本书设置、世界观、总纲
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const body = await readBody(event)
  const next = { ...book }
  if (body.title !== undefined) {
    next.title = String(body.title || '').trim().slice(0, 60)
    if (!next.title) throw new CjError(400, '书名不能为空')
  }
  if (body.chapter_words !== undefined) next.chapter_words = Math.min(Math.max(toInt(body.chapter_words, book.chapter_words), 300), 20000)
  if (body.foreshadow_remind !== undefined) next.foreshadow_remind = Math.min(Math.max(toInt(body.foreshadow_remind, book.foreshadow_remind), 0), 50)
  if (body.budget !== undefined) {
    const budget = Number(body.budget)
    next.budget = Number.isFinite(budget) && budget >= 0 ? Math.min(budget, 1000) : book.budget
  }
  if (body.world !== undefined) next.world = cleanText(body.world, 100000)
  if (body.outline !== undefined) next.outline = cleanText(body.outline, 100000)
  ;(await db.run(sql`
    UPDATE cj_books SET title = ${next.title}, chapter_words = ${next.chapter_words}, foreshadow_remind = ${next.foreshadow_remind},
      budget = ${next.budget}, world = ${next.world}, outline = ${next.outline}, updated_at = datetime('now', '+8 hours')
    WHERE id = ${book.id} AND user_id = ${auth.id}
  `))
  return { code: 200, message: '已保存' }
})
