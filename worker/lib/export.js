import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { formatCard, formatForeshadow, parseJson } from './common.js'
import { CHARACTER_BASE_FIELDS, CHARACTER_STATE_FIELDS } from './memory.js'

// 简易 YAML 输出：字符串一律用双引号（JSON 字符串本身就是合法 YAML），一个字段一行
const yamlScalar = (value) => {
  if (value === null || value === undefined || value === '') return '""'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(String(value))
}

export const toYaml = (value, indent = 0) => {
  const pad = ' '.repeat(indent)
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]`
    return value.map(item => (item && typeof item === 'object')
      ? `${pad}-\n${toYaml(item, indent + 2)}`
      : `${pad}- ${yamlScalar(item)}`).join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === 'object') {
        if (Array.isArray(item) && !item.length) return `${pad}${key}: []`
        if (!Array.isArray(item) && !Object.keys(item).length) return `${pad}${key}: {}`
        return `${pad}${key}:\n${toYaml(item, indent + 2)}`
      }
      return `${pad}${key}: ${yamlScalar(item)}`
    }).join('\n')
  }
  return `${pad}${yamlScalar(value)}`
}

const safeName = (name) => String(name || '未命名').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 60)
const pad3 = (number) => String(number).padStart(3, '0')

export const chapterHeading = (chapter) => `第${chapter.number}章 ${chapter.title || ''}`.trim()

// TXT 排版：去掉 Markdown 标记，段首空两格
export const chapterToTxt = (chapter) => {
  const body = String(chapter.content || '')
    .split('\n')
    .map(line => line.replace(/^#+\s*/, '').replace(/[*_`~]/g, '').replace(/^>\s?/, '').trim())
    .filter(Boolean)
    .map(line => `　　${line}`)
    .join('\n')
  return `${chapterHeading(chapter)}\n\n${body}\n`
}

export const contentDisposition = (fileName, fallback = 'changjuan-export') => `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`

// 整本书导出：正文 Markdown，大纲/人物/设定/伏笔/摘要 YAML，数据库坏了也能据此恢复
export const buildBookArchive = async (book) => {
  const root = safeName(book.title)
  const files = []
  const volumes = (await db.all(sql`SELECT * FROM cj_volumes WHERE book_id = ${book.id} AND user_id = ${book.user_id} ORDER BY sort, id`))
  const chapters = (await db.all(sql`SELECT * FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${book.user_id} ORDER BY number, id`))
  const cards = (await db.all(sql`SELECT * FROM cj_cards WHERE book_id = ${book.id} AND user_id = ${book.user_id} ORDER BY kind, id`)).map(formatCard)
  const foreshadows = (await db.all(sql`SELECT * FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${book.user_id} ORDER BY id`)).map(formatForeshadow)
  const volumeTitle = (id) => volumes.find(item => item.id === id)?.title || ''

  files.push({ name: `${root}/书.yaml`, content: `${toYaml({ 书名: book.title, 每章字数: book.chapter_words, 伏笔提前提醒章数: book.foreshadow_remind, 创建时间: book.created_at, 导出时间: new Date().toISOString() })}\n` })
  files.push({ name: `${root}/设定/世界观.md`, content: book.world || '' })
  files.push({ name: `${root}/大纲/总纲.md`, content: book.outline || '' })
  volumes.forEach((volume, index) => {
    files.push({ name: `${root}/大纲/卷${String(index + 1).padStart(2, '0')}.yaml`, content: `${toYaml({ 卷名: volume.title, 本卷目标: volume.goal, 大纲: volume.outline })}\n` })
  })
  for (const chapter of chapters) {
    const fileBase = `${pad3(chapter.number)} ${safeName(chapter.title)}`
    files.push({
      name: `${root}/大纲/细纲/${fileBase}.yaml`,
      content: `${toYaml({
        章号: chapter.number, 标题: chapter.title, 所属卷: volumeTitle(chapter.volume_id), 本章目标: chapter.goal, 冲突: chapter.conflict,
        爽点: chapter.payoff, 章末钩子: chapter.hook, 出场人物: parseJson(chapter.characters, []),
        关联伏笔: parseJson(chapter.foreshadows, []).map(id => foreshadows.find(item => item.id === id)?.code).filter(Boolean),
        本章字数: chapter.target_words || '', 状态: chapter.status === 'confirmed' ? '已确认' : '草稿'
      })}\n`
    })
    if (chapter.content) files.push({ name: `${root}/正文/${fileBase}.md`, content: `# ${chapterHeading(chapter)}\n\n${chapter.content.split('\n').filter(line => line.trim()).join('\n\n')}\n` })
    if (chapter.summary) files.push({ name: `${root}/记忆库/摘要/${pad3(chapter.number)}.yaml`, content: `${toYaml({ 章号: chapter.number, 标题: chapter.title, 摘要: chapter.summary })}\n` })
  }
  const fieldLabels = Object.fromEntries([...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS])
  for (const card of cards) {
    if (card.kind === 'character') {
      const data = card.data || {}
      const body = { 姓名: card.name, 别名: card.aliases }
      for (const [key, label] of Object.entries(fieldLabels)) body[label] = data[key] ?? ''
      body.关系 = (Array.isArray(data.relations) ? data.relations : []).map(item => ({ 人物: item.name, 关系: item.desc }))
      files.push({ name: `${root}/记忆库/人物/${safeName(card.name)}.yaml`, content: `${toYaml(body)}\n` })
    } else {
      files.push({ name: `${root}/记忆库/设定/${safeName(card.name)}.yaml`, content: `${toYaml({ 名称: card.name, 别名: card.aliases, 类别: card.category, 内容: card.data?.content || '', 固定注入: !!card.data?.pinned })}\n` })
    }
  }
  const statusLabel = { open: '未回收', resolved: '已回收', abandoned: '已放弃' }
  for (const item of foreshadows) {
    files.push({
      name: `${root}/记忆库/伏笔/${safeName(item.code)}.yaml`,
      content: `${toYaml({ 编号: item.code, 内容: item.content, 相关人物: item.characters, 埋设章节: item.planted_chapter ?? '', 计划回收: item.planned_chapter ?? '', 状态: statusLabel[item.status] || item.status, 回收章节: item.resolved_chapter ?? '', 备注: item.note })}\n`
    })
  }
  return { root, files }
}
