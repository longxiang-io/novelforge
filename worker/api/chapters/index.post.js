import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, getBook, readBody, toInt, touchBook } from '../../lib/common.js'
import { readOutlineFields } from '../../lib/chapter-fields.js'

// POST /api/changjuan/chapters - 新建章节（细纲），默认接在最后一章后面
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const book = (await getBook(auth.id, toInt(body.book_id, 0)))
  const last = (await db.get(sql`SELECT number, volume_id FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY number DESC LIMIT 1`))
  const firstVolume = (await db.get(sql`SELECT id FROM cj_volumes WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY sort, id LIMIT 1`))
  const base = {
    id: 0, title: '', goal: '', conflict: '', payoff: '', hook: '', characters: '[]', foreshadows: '[]',
    target_words: null, volume_id: last?.volume_id || firstVolume?.id || null, number: (last?.number || 0) + 1
  }
  const next = (await readOutlineFields({ ...body, number: body.number ?? base.number }, base, book))
  if (!next.title) next.title = `第 ${next.number} 章`
  const result = (await db.run(sql`
    INSERT INTO cj_chapters (user_id, book_id, volume_id, number, title, goal, conflict, payoff, hook, characters, foreshadows, target_words)
    VALUES (${auth.id}, ${book.id}, ${next.volume_id}, ${next.number}, ${next.title}, ${next.goal}, ${next.conflict}, ${next.payoff}, ${next.hook}, ${next.characters}, ${next.foreshadows}, ${next.target_words})
  `))
  ;(await touchBook(book.id, auth.id))
  return { code: 200, message: '已新建', data: { id: Number(result.lastInsertRowid), number: next.number } }
})
