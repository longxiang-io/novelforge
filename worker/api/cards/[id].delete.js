import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, getCard, paramId } from '../../lib/common.js'

// DELETE /api/changjuan/cards/:id - 删除卡片
export default cjHandler(async (event, auth) => {
  const card = (await getCard(auth.id, paramId(event)))
  ;(await db.run(sql`DELETE FROM cj_cards WHERE id = ${card.id} AND user_id = ${auth.id}`))
  return { code: 200, message: '已删除' }
})
