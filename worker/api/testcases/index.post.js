import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, readBody } from '../../lib/common.js'
import { readTestcaseInput } from '../../lib/testcase-input.js'

// POST /api/changjuan/testcases - 新增测试用例（body.id 存在时为修改）
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const input = readTestcaseInput(body)
  if (body.id) {
    const result = (await db.run(sql`UPDATE cj_testcases SET title = ${input.title}, context = ${input.context}, content = ${input.content}, expected = ${JSON.stringify(input.expected)} WHERE id = ${Number(body.id)} AND user_id = ${auth.id}`))
    if (!result.changes) throw new CjError(404, '测试用例不存在或无权访问')
    return { code: 200, message: '已保存' }
  }
  const count = (await db.get(sql`SELECT COUNT(*) AS count FROM cj_testcases WHERE user_id = ${auth.id}`))
  if (count.count >= 30) throw new CjError(400, '测试集最多 30 章')
  ;(await db.run(sql`INSERT INTO cj_testcases (user_id, title, context, content, expected) VALUES (${auth.id}, ${input.title}, ${input.context}, ${input.content}, ${JSON.stringify(input.expected)})`))
  return { code: 200, message: '已添加' }
})
