import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, getBook, getChapter, paramId, splitParagraphs } from '../../../lib/common.js'
import { buildFacts, mergeIssues, ruleIssues, runModelCheck } from '../../../lib/checker.js'
import { chapterDetail } from '../../../lib/views.js'

// POST /api/changjuan/chapters/:id/check - 一致性检查：规则检查 + 模型检查，结果按严重程度保存为新一轮
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  const book = (await getBook(auth.id, chapter.book_id))
  if (chapter.status === 'confirmed') throw new CjError(409, '本章已确认，无需再检查')
  if (!chapter.content.trim()) throw new CjError(400, '本章还没有正文')

  const paragraphs = splitParagraphs(chapter.content)
  const facts = (await buildFacts(book, chapter.number))
  const falsePositives = (await db.all(sql`SELECT title, quote, fp_reason, fp_note FROM cj_issues WHERE book_id = ${book.id} AND user_id = ${auth.id} AND false_positive = 1 ORDER BY id DESC LIMIT 10`))
  const suppressed = (await db.all(sql`SELECT title FROM cj_issues WHERE chapter_id = ${chapter.id} AND user_id = ${auth.id} AND false_positive = 1 AND fp_suppress = 1`)).map(row => row.title)

  const model = await runModelCheck({ userId: auth.id, bookId: book.id, chapterId: chapter.id, content: chapter.content, facts: facts.text, falsePositives })
  const issues = mergeIssues(ruleIssues(paragraphs, facts.characters), model.issues)
    .filter(issue => !suppressed.includes(issue.title))

  // 正文的同一句话此前已标为误报的，沿用误报标记
  const previousFp = (await db.all(sql`SELECT title, quote, fp_reason, fp_note FROM cj_issues WHERE chapter_id = ${chapter.id} AND user_id = ${auth.id} AND false_positive = 1`))
  const run = chapter.check_run + 1
  const statements = issues.map((issue, index) => {
    const fp = previousFp.find(item => item.title === issue.title && item.quote === issue.quote)
    return sql`
      INSERT INTO cj_issues (user_id, book_id, chapter_id, run, seq, severity, title, quote, paragraph, basis, card_name, source, false_positive, fp_reason, fp_note)
      VALUES (${auth.id}, ${book.id}, ${chapter.id}, ${run}, ${index + 1}, ${issue.severity}, ${issue.title}, ${issue.quote}, ${issue.paragraph}, ${issue.basis}, ${issue.card_name}, ${issue.source}, ${fp ? 1 : 0}, ${fp?.fp_reason || ''}, ${fp?.fp_note || ''})
    `
  })
  // 重新检查后，之前提取的记忆库改动作废，确认前会重新提取
  statements.push(sql`DELETE FROM cj_changes WHERE chapter_id = ${chapter.id} AND user_id = ${auth.id}`)
  statements.push(sql`UPDATE cj_chapters SET check_run = ${run}, check_dirty = 0, checked_at = datetime('now', '+8 hours') WHERE id = ${chapter.id} AND user_id = ${auth.id}`)
  ;(await db.batch(statements))
  return { code: 200, message: '检查完成', data: (await chapterDetail((await getChapter(auth.id, chapter.id)))) }
})
