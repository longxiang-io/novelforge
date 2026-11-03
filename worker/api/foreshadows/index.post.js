import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, cleanList, getBook, nextForeshadowCode, readBody, toInt, touchBook } from '../../lib/common.js'

// POST /api/changjuan/foreshadows - 手动添加伏笔
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const book = (await getBook(auth.id, toInt(body.book_id, 0)))
  const content = String(body.content || '').trim().slice(0, 500)
  if (!content) throw new CjError(400, '请填写伏笔内容')
  const code = (await nextForeshadowCode(book.id, auth.id))
  const result = (await db.run(sql`
    INSERT INTO cj_foreshadows (user_id, book_id, code, content, characters, planted_chapter, planned_chapter, note)
    VALUES (${auth.id}, ${book.id}, ${code}, ${content}, ${JSON.stringify(cleanList(body.characters, 20))}, ${toInt(body.planted_chapter, null)}, ${toInt(body.planned_chapter, null)}, ${String(body.note || '').slice(0, 500)})
  `))
  ;(await touchBook(book.id, auth.id))
  return { code: 200, message: `已添加 ${code}`, data: { id: Number(result.lastInsertRowid), code } }
})
