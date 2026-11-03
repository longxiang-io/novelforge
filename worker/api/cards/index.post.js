import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, formatCard, getBook, readBody, toInt, touchBook } from '../../lib/common.js'
import { readCardInput } from '../../lib/card-fields.js'

// POST /api/changjuan/cards - 新建人物卡 / 设定卡
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const book = (await getBook(auth.id, toInt(body.book_id, 0)))
  const input = readCardInput(body)
  if (input.kind === 'character' && input.data.alive === undefined) input.data.alive = '是'
  if (input.kind === 'character' && input.data.present === undefined) input.data.present = '是'
  if ((await db.get(sql`SELECT id FROM cj_cards WHERE book_id = ${book.id} AND user_id = ${auth.id} AND kind = ${input.kind} AND name = ${input.name}`))) {
    throw new CjError(400, `「${input.name}」已经有卡片了`)
  }
  const result = (await db.run(sql`
    INSERT INTO cj_cards (user_id, book_id, kind, name, aliases, category, data)
    VALUES (${auth.id}, ${book.id}, ${input.kind}, ${input.name}, ${input.aliases}, ${input.category}, ${JSON.stringify(input.data)})
  `))
  ;(await touchBook(book.id, auth.id))
  return { code: 200, message: '已新建', data: formatCard((await db.get(sql`SELECT * FROM cj_cards WHERE id = ${Number(result.lastInsertRowid)} AND user_id = ${auth.id}`))) }
})
