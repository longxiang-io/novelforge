import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, cleanText, getBook, readBody, toInt } from '../../lib/common.js'

// POST /api/changjuan/volumes - 新增分卷
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const book = (await getBook(auth.id, toInt(body.book_id, 0)))
  const count = (await db.get(sql`SELECT COUNT(*) AS count, COALESCE(MAX(sort), 0) AS sort FROM cj_volumes WHERE book_id = ${book.id} AND user_id = ${auth.id}`))
  const numerals = '一二三四五六七八九十'
  const title = String(body.title || '').trim().slice(0, 60) || `卷${numerals[count.count] || count.count + 1}`
  const result = (await db.run(sql`
    INSERT INTO cj_volumes (user_id, book_id, sort, title, goal, outline)
    VALUES (${auth.id}, ${book.id}, ${count.sort + 1}, ${title}, ${cleanText(body.goal, 2000)}, ${cleanText(body.outline, 50000)})
  `))
  return { code: 200, message: '已添加', data: { id: Number(result.lastInsertRowid) } }
})
