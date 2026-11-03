import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, parseJson } from '../../lib/common.js'
import { runModelCheck } from '../../lib/checker.js'
import { CHECK_PROMPT_VERSION } from '../../lib/prompts.js'
import { formatWait, getRateLimitWait, hitRateLimit } from '../../lib/rate-limit.js'

// POST /api/changjuan/testcases/run - 用当前检查提示词跑一遍测试集，统计漏报与误报
export default cjHandler(async (event, auth) => {
  const cases = (await db.all(sql`SELECT * FROM cj_testcases WHERE user_id = ${auth.id} ORDER BY id`))
  if (!cases.length) throw new CjError(400, '测试集是空的，先添加或插入示例')
  const key = `changjuan-test:${auth.id}`
  const wait = getRateLimitWait(key, 1)
  if (wait) throw new CjError(429, `测试集正在运行或刚运行过，请 ${formatWait(wait)}后再试`)
  hitRateLimit(key, 30 * 1000)

  let caught = 0
  let total = 0
  let issueCount = 0
  let falseCount = 0
  const details = []
  for (const item of cases) {
    const expected = parseJson(item.expected, [])
    const result = await runModelCheck({ userId: auth.id, bookId: null, chapterId: null, content: item.content, facts: item.context, falsePositives: [], task: 'test' })
    const hay = (issue) => `${issue.quote} ${issue.title} ${issue.basis}`
    const hits = expected.map(target => ({ ...target, caught: result.issues.some(issue => hay(issue).includes(target.keyword)) }))
    const unmatched = result.issues.filter(issue => !expected.some(target => hay(issue).includes(target.keyword)))
    caught += hits.filter(hit => hit.caught).length
    total += hits.length
    issueCount += result.issues.length
    falseCount += unmatched.length
    details.push({ id: item.id, title: item.title, hits, extra: unmatched.map(issue => issue.title) })
  }
  ;(await db.run(sql`
    INSERT INTO cj_test_runs (user_id, prompt_version, caught, total, issue_count, false_count, details)
    VALUES (${auth.id}, ${CHECK_PROMPT_VERSION}, ${caught}, ${total}, ${issueCount}, ${falseCount}, ${JSON.stringify(details)})
  `))
  return { code: 200, message: `抓到 ${caught}/${total}`, data: { caught, total, issue_count: issueCount, false_count: falseCount, details } }
})
