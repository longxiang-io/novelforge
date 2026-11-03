import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, readBody, toInt } from '../../lib/common.js'
import { DEFAULT_OUTLINE, DEFAULT_WORLD } from '../../lib/book-defaults.js'

// POST /api/changjuan/books - 新建一本书（只需书名、每章目标字数、伏笔提前提醒章数），自动建"卷一"
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const title = String(body.title || '').trim().slice(0, 60)
  if (!title) throw new CjError(400, '请填写书名')
  const exists = (await db.get(sql`SELECT id FROM cj_books WHERE user_id = ${auth.id} AND title = ${title}`))
  if (exists) throw new CjError(400, '已经有同名的书了')
  const chapterWords = Math.min(Math.max(toInt(body.chapter_words, 2500), 300), 20000)
  const remind = Math.min(Math.max(toInt(body.foreshadow_remind, 3), 0), 50)

  const results = (await db.batch([
    sql`
      INSERT INTO cj_books (user_id, title, chapter_words, foreshadow_remind, world, outline)
      VALUES (${auth.id}, ${title}, ${chapterWords}, ${remind}, ${DEFAULT_WORLD}, ${DEFAULT_OUTLINE})
    `,
    sql`INSERT INTO cj_volumes (user_id, book_id, sort, title) VALUES (${auth.id}, last_insert_rowid(), 1, '卷一')`
  ]))
  const bookId = Number(results[0].lastInsertRowid)
  return { code: 200, message: '已创建', data: { id: bookId } }
})
