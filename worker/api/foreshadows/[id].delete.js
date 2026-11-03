import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, getForeshadow, paramId } from '../../lib/common.js'

// DELETE /api/changjuan/foreshadows/:id - 删除伏笔
export default cjHandler(async (event, auth) => {
  const row = (await getForeshadow(auth.id, paramId(event)))
  ;(await db.run(sql`DELETE FROM cj_foreshadows WHERE id = ${row.id} AND user_id = ${auth.id}`))
  return { code: 200, message: '已删除' }
})
