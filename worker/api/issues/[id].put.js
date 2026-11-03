import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, paramId, readBody } from '../../lib/common.js'

const REASONS = ['故意这样写', '检查理解错了原文', '记忆库信息过时', '其他']

// PUT /api/changjuan/issues/:id - 标记 / 取消误报（原因会用来改进检查提示词）
export default cjHandler(async (event, auth) => {
  const id = paramId(event)
  const issue = (await db.get(sql`SELECT * FROM cj_issues WHERE id = ${id} AND user_id = ${auth.id}`))
  if (!issue) throw new CjError(404, '问题不存在或无权访问')
  const body = await readBody(event)
  const falsePositive = body.false_positive ? 1 : 0
  const reason = falsePositive && REASONS.includes(body.reason) ? body.reason : ''
  const note = falsePositive ? String(body.note || '').trim().slice(0, 300) : ''
  const suppress = falsePositive && body.suppress ? 1 : 0
  ;(await db.run(sql`UPDATE cj_issues SET false_positive = ${falsePositive}, fp_reason = ${reason}, fp_note = ${note}, fp_suppress = ${suppress} WHERE id = ${id} AND user_id = ${auth.id}`))
  return { code: 200, message: falsePositive ? '已标为误报' : '已取消误报' }
})
