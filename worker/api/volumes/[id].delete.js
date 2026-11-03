import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, paramId } from '../../lib/common.js'

// DELETE /api/changjuan/volumes/:id - 删除空的分卷
export default cjHandler(async (event, auth) => {
  const id = paramId(event)
  const volume = (await db.get(sql`SELECT * FROM cj_volumes WHERE id = ${id} AND user_id = ${auth.id}`))
  if (!volume) throw new CjError(404, '分卷不存在或无权访问')
  const used = (await db.get(sql`SELECT COUNT(*) AS count FROM cj_chapters WHERE volume_id = ${id} AND user_id = ${auth.id}`))
  if (used.count) throw new CjError(400, '这一卷下还有章节，先删除或移走章节')
  ;(await db.run(sql`DELETE FROM cj_volumes WHERE id = ${id} AND user_id = ${auth.id}`))
  return { code: 200, message: '已删除' }
})
