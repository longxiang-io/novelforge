import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, formatCard, formatForeshadow, getBook, paramId, parseJson, queryOf } from '../../../lib/common.js'
import { cleanQuery, likePattern, searchBook } from '../../../lib/search.js'

// GET /api/changjuan/books/:id/search?q= - 在这本书的正文、大纲、卡片和伏笔里查找
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const query = cleanQuery(queryOf(event).q)
  if (!query) return { code: 200, data: { query: '', hits: [] } }
  const pattern = likePattern(query)
  const chapters = (await db.all(sql`
    SELECT id, number, title, goal, conflict, payoff, hook, characters, summary, content
    FROM cj_chapters
    WHERE book_id = ${book.id} AND user_id = ${auth.id}
      AND (
        title LIKE ${pattern} ESCAPE '\\'
        OR goal LIKE ${pattern} ESCAPE '\\'
        OR conflict LIKE ${pattern} ESCAPE '\\'
        OR payoff LIKE ${pattern} ESCAPE '\\'
        OR hook LIKE ${pattern} ESCAPE '\\'
        OR characters LIKE ${pattern} ESCAPE '\\'
        OR summary LIKE ${pattern} ESCAPE '\\'
        OR content LIKE ${pattern} ESCAPE '\\'
      )
    ORDER BY number
    LIMIT 40
  `)).map(row => ({ ...row, characters: parseJson(row.characters, []) }))
  const volumes = (await db.all(sql`SELECT id, title, goal, outline FROM cj_volumes WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY sort, id`))
  const cards = (await db.all(sql`SELECT * FROM cj_cards WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY id`)).map(formatCard)
  const foreshadows = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY id`)).map(formatForeshadow)
  return { code: 200, data: { query, hits: searchBook({ query, book, volumes, chapters, cards, foreshadows }) } }
})
