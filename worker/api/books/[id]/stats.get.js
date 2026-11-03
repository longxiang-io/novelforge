import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, countWords, getBook, paramId, parseJson } from '../../../lib/common.js'
import { bookCost } from '../../../lib/views.js'

// 生成原文中没有原样保留下来的字数占比（按段比对，粗略估计手改比例）
const editRatio = (generated, content) => {
  const original = String(generated || '').split('\n').map(line => line.trim()).filter(Boolean)
  if (!original.length) return null
  const kept = new Set(String(content || '').split('\n').map(line => line.trim()).filter(Boolean))
  const total = original.reduce((sum, line) => sum + line.length, 0)
  const changed = original.filter(line => !kept.has(line)).reduce((sum, line) => sum + line.length, 0)
  return total ? changed / total : null
}

// GET /api/changjuan/books/:id/stats - 统计：费用、误报率、手改比例、测试集
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const chapters = (await db.all(sql`SELECT id, number, title, status, content, generated_content, check_run FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY number`))
  const usage = (await db.all(sql`
    SELECT chapter_id, task, COUNT(*) AS calls, COALESCE(SUM(cost), 0) AS cost, COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
    FROM cj_usage WHERE book_id = ${book.id} AND user_id = ${auth.id} GROUP BY chapter_id, task
  `))
  const perChapter = chapters.map(chapter => {
    const rows = usage.filter(row => row.chapter_id === chapter.id)
    const byTask = Object.fromEntries(rows.map(row => [row.task, { cost: row.cost, tokens: row.tokens, calls: row.calls }]))
    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      words: countWords(chapter.content),
      by_task: byTask,
      cost: rows.reduce((sum, row) => sum + row.cost, 0),
      tokens: rows.reduce((sum, row) => sum + row.tokens, 0),
      generate_calls: byTask.generate?.calls || 0
    }
  })
  const totals = {}
  for (const row of usage) {
    totals[row.task] = totals[row.task] || { cost: 0, tokens: 0, calls: 0 }
    totals[row.task].cost += row.cost
    totals[row.task].tokens += row.tokens
    totals[row.task].calls += row.calls
  }
  const issueRow = (await db.get(sql`
    SELECT COUNT(*) AS total, COALESCE(SUM(i.false_positive), 0) AS fp FROM cj_issues i
    JOIN cj_chapters c ON c.id = i.chapter_id AND c.user_id = ${auth.id} AND i.run = c.check_run
    WHERE i.book_id = ${book.id} AND i.user_id = ${auth.id}
  `))
  const ratios = chapters.map(chapter => editRatio(chapter.generated_content, chapter.content)).filter(value => value !== null)
  const confirmedWords = chapters.filter(item => item.status === 'confirmed').reduce((sum, item) => sum + countWords(item.content), 0)
  const cost = (await bookCost(book.id, auth.id))
  const runs = (await db.all(sql`SELECT * FROM cj_test_runs WHERE user_id = ${auth.id} ORDER BY id DESC LIMIT 10`)).map(row => ({ ...row, details: parseJson(row.details, []) }))
  const caseCount = (await db.get(sql`SELECT COUNT(*) AS count, COALESCE(SUM(json_array_length(expected)), 0) AS errors FROM cj_testcases WHERE user_id = ${auth.id}`))
  return {
    code: 200,
    data: {
      per_chapter: perChapter,
      totals,
      total_cost: cost.cost,
      total_tokens: cost.tokens,
      cost_per_10k: confirmedWords ? (cost.cost / confirmedWords) * 10000 : null,
      false_positive_rate: issueRow.total ? issueRow.fp / issueRow.total : null,
      issue_total: issueRow.total,
      edit_ratio: ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : null,
      confirmed_words: confirmedWords,
      test_runs: runs,
      testcase_count: caseCount.count,
      testcase_errors: caseCount.errors
    }
  }
})
