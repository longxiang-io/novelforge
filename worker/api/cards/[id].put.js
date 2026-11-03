import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, formatCard, getCard, paramId, readBody, touchBook } from '../../lib/common.js'
import { readCardInput } from '../../lib/card-fields.js'

// PUT /api/changjuan/cards/:id - 手动编辑卡片
export default cjHandler(async (event, auth) => {
  const card = formatCard((await getCard(auth.id, paramId(event))))
  const input = readCardInput(await readBody(event), card)
  if (input.name !== card.name && (await db.get(sql`SELECT id FROM cj_cards WHERE book_id = ${card.book_id} AND user_id = ${auth.id} AND kind = ${card.kind} AND name = ${input.name} AND id != ${card.id}`))) {
    throw new CjError(400, `「${input.name}」已经有卡片了`)
  }
  ;(await db.run(sql`
    UPDATE cj_cards SET name = ${input.name}, aliases = ${input.aliases}, category = ${input.category}, data = ${JSON.stringify(input.data)}, updated_at = datetime('now', '+8 hours')
    WHERE id = ${card.id} AND user_id = ${auth.id}
  `))
  ;(await touchBook(card.book_id, auth.id))
  return { code: 200, message: '已保存', data: formatCard((await db.get(sql`SELECT * FROM cj_cards WHERE id = ${card.id} AND user_id = ${auth.id}`))) }
})
