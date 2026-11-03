import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, parseJson } from '../../lib/common.js'
import { CHECK_PROMPT_VERSION } from '../../lib/prompts.js'

// GET /api/changjuan/testcases - 一致性检查埋错测试集（按用户）
export default cjHandler(async (event, auth) => {
  const list = (await db.all(sql`SELECT * FROM cj_testcases WHERE user_id = ${auth.id} ORDER BY id`)).map(row => ({ ...row, expected: parseJson(row.expected, []) }))
  return { code: 200, data: { list, prompt_version: CHECK_PROMPT_VERSION } }
})
