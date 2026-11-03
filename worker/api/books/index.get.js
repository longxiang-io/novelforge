import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler } from '../../lib/common.js'
import { bookOverview, monthCost } from '../../lib/views.js'

// GET /api/changjuan/books - 我的书架
export default cjHandler(async (event, auth) => {
  const books = (await db.all(sql`SELECT * FROM cj_books WHERE user_id = ${auth.id} ORDER BY updated_at DESC, id DESC`))
  const data = []
  for (const book of books) {
    const overview = (await bookOverview(book))
    delete overview.chapters
    data.push({ id: book.id, title: book.title, chapter_words: book.chapter_words, foreshadow_remind: book.foreshadow_remind, updated_at: book.updated_at, ...overview })
  }
  return { code: 200, data: { books: data, month: (await monthCost(auth.id)) } }
})
