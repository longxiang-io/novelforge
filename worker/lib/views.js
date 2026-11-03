import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { countWords, formatChapter, parseJson } from './common.js'

// 列表/页头常用的聚合数据

// 每章当前一轮检查中未标误报的"必须改"数量
export const mustCountsByChapter = async (bookId, userId) => {
  const rows = (await db.all(sql`
    SELECT i.chapter_id AS chapter_id, COUNT(*) AS count FROM cj_issues i
    JOIN cj_chapters c ON c.id = i.chapter_id AND c.user_id = ${userId} AND i.run = c.check_run
    WHERE i.book_id = ${bookId} AND i.user_id = ${userId} AND i.severity = 'must' AND i.false_positive = 0
    GROUP BY i.chapter_id
  `))
  return Object.fromEntries(rows.map(row => [row.chapter_id, row.count]))
}

// 章节圆点：ok 已确认 / red 有必须改 / amber 已生成待检查 / none 只有细纲
export const chapterDot = (chapter, mustCount) => {
  if (chapter.status === 'confirmed') return 'ok'
  if (!String(chapter.content || '').trim()) return 'none'
  if (chapter.check_run > 0 && !chapter.check_dirty && mustCount > 0) return 'red'
  return 'amber'
}

export const chapterListItem = (chapter, mustCount = 0) => ({
  id: chapter.id,
  volume_id: chapter.volume_id,
  number: chapter.number,
  title: chapter.title,
  status: chapter.status,
  word_count: countWords(chapter.content),
  must_count: mustCount,
  dot: chapterDot(chapter, mustCount)
})

export const monthCost = async (userId) => {
  const row = (await db.get(sql`
    SELECT COALESCE(SUM(cost), 0) AS cost, COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
    FROM cj_usage WHERE user_id = ${userId} AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now', '+8 hours')
  `))
  return { cost: row.cost, tokens: row.tokens }
}

export const bookCost = async (bookId, userId) => (await db.get(sql`
  SELECT COALESCE(SUM(cost), 0) AS cost, COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens, COUNT(*) AS calls
  FROM cj_usage WHERE book_id = ${bookId} AND user_id = ${userId}
`))

// 当前写到第几章：有正文的最大章号
export const currentChapterNumber = async (bookId, userId) => (await db.get(sql`SELECT COALESCE(MAX(number), 0) AS number FROM cj_chapters WHERE book_id = ${bookId} AND user_id = ${userId} AND content != ''`)).number

export const bookOverview = async (book) => {
  const chapters = (await db.all(sql`SELECT id, volume_id, number, title, status, content, check_run, check_dirty FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${book.user_id} ORDER BY number, id`))
  const mustCounts = (await mustCountsByChapter(book.id, book.user_id))
  const confirmed = chapters.filter(item => item.status === 'confirmed')
  const confirmedWords = confirmed.reduce((sum, item) => sum + countWords(item.content), 0)
  const cost = (await bookCost(book.id, book.user_id))
  const current = (await currentChapterNumber(book.id, book.user_id))
  const remind = Number(book.foreshadow_remind) || 3
  const foreshadowRows = (await db.all(sql`SELECT planned_chapter FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${book.user_id} AND status = 'open' AND planned_chapter IS NOT NULL`))
  const overdue = foreshadowRows.filter(item => item.planned_chapter < current).length
  const dueSoon = foreshadowRows.filter(item => item.planned_chapter >= current && item.planned_chapter <= current + remind).length
  const nextChapter = chapters.find(item => item.status !== 'confirmed') || null
  return {
    chapters: chapters.map(item => chapterListItem(item, mustCounts[item.id] || 0)),
    confirmed_count: confirmed.length,
    confirmed_words: confirmedWords,
    total_cost: cost.cost,
    total_tokens: cost.tokens,
    cost_per_10k: confirmedWords ? (cost.cost / confirmedWords) * 10000 : null,
    must_issue_chapters: Object.keys(mustCounts).length,
    overdue_foreshadows: overdue,
    due_soon_foreshadows: dueSoon,
    current_chapter: current,
    next_chapter: nextChapter ? { id: nextChapter.id, number: nextChapter.number, title: nextChapter.title, must_count: mustCounts[nextChapter.id] || 0 } : null
  }
}

export const chapterCost = async (chapterId, userId) => {
  const rows = (await db.all(sql`
    SELECT task, COUNT(*) AS calls, COALESCE(SUM(cost), 0) AS cost, SUM(cost IS NULL) AS unpriced,
      COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens, COALESCE(SUM(completion_tokens), 0) AS completion_tokens
    FROM cj_usage WHERE chapter_id = ${chapterId} AND user_id = ${userId} GROUP BY task
  `))
  const total = rows.reduce((sum, row) => sum + row.cost, 0)
  const tokens = rows.reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0)
  return { total, tokens, by_task: rows }
}

export const chapterDetail = async (chapter) => {
  const issues = (await db.all(sql`SELECT * FROM cj_issues WHERE chapter_id = ${chapter.id} AND user_id = ${chapter.user_id} AND run = ${chapter.check_run} ORDER BY seq`))
  const changes = (await db.all(sql`SELECT * FROM cj_changes WHERE chapter_id = ${chapter.id} AND user_id = ${chapter.user_id} ORDER BY id`)).map(row => ({ ...row, payload: parseJson(row.payload, {}) }))
  const lastCheck = (await db.get(sql`SELECT cost, created_at FROM cj_usage WHERE chapter_id = ${chapter.id} AND user_id = ${chapter.user_id} AND task = 'check' ORDER BY id DESC LIMIT 1`))
  const version = (await db.get(sql`SELECT id, label, created_at, stats FROM cj_versions WHERE chapter_id = ${chapter.id} AND user_id = ${chapter.user_id} AND reverted = 0 ORDER BY id DESC LIMIT 1`))
  const mustOpen = issues.filter(item => item.severity === 'must' && !item.false_positive).length
  return {
    ...formatChapter(chapter),
    issues,
    changes,
    must_open: mustOpen,
    can_extract: chapter.status !== 'confirmed' && chapter.check_run > 0 && !chapter.check_dirty && mustOpen === 0,
    last_check_cost: lastCheck?.cost ?? null,
    cost: (await chapterCost(chapter.id, chapter.user_id)),
    version: version ? { ...version, stats: parseJson(version.stats, {}) } : null
  }
}
