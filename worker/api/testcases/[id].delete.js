import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, paramId } from '../../lib/common.js'

// DELETE /api/changjuan/testcases/:id
export default cjHandler(async (event, auth) => {
  const result = (await db.run(sql`DELETE FROM cj_testcases WHERE id = ${paramId(event)} AND user_id = ${auth.id}`))
  if (!result.changes) throw new CjError(404, '测试用例不存在或无权访问')
  return { code: 200, message: '已删除' }
})
