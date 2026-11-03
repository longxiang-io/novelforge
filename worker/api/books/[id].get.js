import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, getBook, paramId } from '../../lib/common.js'
import { bookOverview, monthCost } from '../../lib/views.js'

// GET /api/changjuan/books/:id - 书的概况：卷、章节列表（含状态圆点）、页头统计
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const volumes = (await db.all(sql`SELECT * FROM cj_volumes WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY sort, id`))
  return { code: 200, data: { book, volumes, ...(await bookOverview(book)), month: (await monthCost(auth.id)) } }
})
