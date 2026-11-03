import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { formatForeshadow, splitParagraphs } from './common.js'
import { characterToText, foreshadowToText, listCards, settingToText } from './memory.js'
import { buildCheckMessages } from './prompts.js'
import { chatCompletion, parseModelJson } from './llm.js'

const SEVERITIES = ['must', 'should', 'hint']
const FACTS_LIMIT = 16000

const normalizeQuote = (quote) => String(quote || '').replace(/^[「『“"']+|[」』”"']+$/g, '').replace(/(……|\.\.\.)+$/g, '').trim()

// 根据引用找到原文段号；找不到时退回模型给的段号
export const locateParagraph = (paragraphs, quote, hint) => {
  const target = normalizeQuote(quote)
  if (target) {
    const probes = [target, target.slice(0, 16), target.slice(0, 8)].filter(item => item.length >= 4)
    for (const probe of probes) {
      const index = paragraphs.findIndex(text => text.includes(probe))
      if (index >= 0) return index + 1
    }
  }
  const number = Number.parseInt(hint, 10)
  return number >= 1 && number <= paragraphs.length ? number : null
}

// 记忆库事实：人物卡、设定、未回收伏笔、最近的章节摘要
export const buildFacts = async (book, chapterNumber) => {
  const characters = (await listCards(book.id, 'character', book.user_id))
  const settings = (await listCards(book.id, 'setting', book.user_id))
  const foreshadows = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${book.user_id} AND status = 'open' ORDER BY id`)).map(formatForeshadow)
  const summaries = (await db.all(sql`SELECT number, title, summary FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${book.user_id} AND number < ${chapterNumber} AND summary != '' ORDER BY number DESC LIMIT 5`)).reverse()
  const parts = [
    characters.length && `人物：\n${characters.map(characterToText).join('\n\n')}`,
    settings.length && `设定：\n${settings.map(settingToText).join('\n')}`,
    foreshadows.length && `未回收伏笔：\n${foreshadows.map(foreshadowToText).join('\n')}`,
    summaries.length && `前情摘要：\n${summaries.map(item => `第 ${item.number} 章：${item.summary}`).join('\n')}`
  ].filter(Boolean)
  return { text: parts.join('\n\n').slice(0, FACTS_LIMIT), characters }
}

// 规则检查：已死亡 / 已离场的人物在正文里出现（不依赖模型，回忆类写法可标为误报）
export const ruleIssues = (paragraphs, characters) => {
  const issues = []
  for (const card of characters) {
    const data = card.data || {}
    const dead = String(data.alive || '').trim() === '否'
    const away = !dead && String(data.present || '').trim() === '否'
    if (!dead && !away) continue
    const names = [card.name, ...String(card.aliases || '').split(/[,，、\s]+/)].filter(item => item && item.length >= 2)
    const index = paragraphs.findIndex(text => names.some(name => text.includes(name)))
    if (index < 0) continue
    issues.push({
      severity: dead ? 'must' : 'should',
      title: dead ? '已死亡角色出场' : '已离场角色出场',
      paragraph: index + 1,
      quote: paragraphs[index].slice(0, 80),
      basis: `依据：${card.name} ${dead ? '存活：否' : '在场：否'}${data.last_seen ? `（最后出场第 ${data.last_seen} 章）` : ''}`,
      card_name: card.name,
      source: 'rule'
    })
  }
  return issues
}

const normalizeIssues = (raw, paragraphs) => (Array.isArray(raw?.issues) ? raw.issues : [])
  .filter(item => item && (item.title || item.quote))
  .map(item => ({
    severity: SEVERITIES.includes(item.severity) ? item.severity : 'hint',
    title: String(item.title || '可能的问题').slice(0, 60),
    quote: normalizeQuote(item.quote).slice(0, 300),
    paragraph: locateParagraph(paragraphs, item.quote, item.paragraph),
    basis: String(item.basis || '').slice(0, 300),
    card_name: String(item.card || '').slice(0, 60),
    source: 'model'
  }))

// 调用检查模型；facts 为记忆库事实文本
export const runModelCheck = async ({ userId, bookId, chapterId, content, facts, falsePositives, task = 'check' }) => {
  const paragraphs = splitParagraphs(content)
  const result = await chatCompletion({
    task: 'check',
    usageTask: task,
    messages: buildCheckMessages({ facts, paragraphs, falsePositives }),
    userId,
    bookId,
    chapterId,
    temperature: 0.1
  })
  return { issues: normalizeIssues(parseModelJson(result.text), paragraphs), cost: result.cost, usage: result.usage }
}

// 合并规则问题与模型问题：同一段同一人物只保留规则那条，按严重程度排序
export const mergeIssues = (rules, models) => {
  const merged = [...rules]
  for (const issue of models) {
    const duplicated = rules.some(rule => rule.paragraph === issue.paragraph && (!issue.card_name || rule.card_name === issue.card_name) && /死|离场/.test(issue.title))
    if (!duplicated) merged.push(issue)
  }
  return merged.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
}
