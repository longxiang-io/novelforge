import { DEFAULT_OUTLINE, DEFAULT_WORLD } from './book-defaults.js'
import { CHARACTER_BASE_FIELDS, CHARACTER_STATE_FIELDS } from './memory.js'

const LIMITS = { prose: 12, summary: 8, outline: 12, card: 10, foreshadow: 8 }

export const cleanQuery = (value) => String(value || '').trim().slice(0, 40)

export const likePattern = (query) => `%${cleanQuery(query).replace(/[\\%_]/g, (char) => `\\${char}`)}%`

export const findSnippet = (text, query) => {
  const source = String(text || '').replace(/\s+/g, ' ').trim()
  const needle = cleanQuery(query).toLowerCase()
  if (!needle || !source) return ''
  const at = source.toLowerCase().indexOf(needle)
  if (at < 0) return ''
  const start = Math.max(0, at - 18)
  const end = Math.min(source.length, at + needle.length + 18)
  let snippet = source.slice(start, end).trim()
  if (start > 0) snippet = `…${snippet}`
  if (end < source.length) snippet = `${snippet}…`
  return snippet
}

const paragraphOf = (content, query) => {
  const needle = cleanQuery(query).toLowerCase()
  const lines = String(content || '').split('\n').map(line => line.trim()).filter(Boolean)
  const index = lines.findIndex(line => line.toLowerCase().includes(needle))
  return index >= 0 ? index + 1 : 0
}

const hit = (extra) => ({
  page: '',
  kind: '',
  label: '',
  title: '',
  snippet: '',
  chapter_id: 0,
  paragraph: 0,
  outline_type: '',
  outline_id: 0,
  card: '',
  foreshadow_id: 0,
  ...extra
})

// 在已经取出的这本书材料里找命中。调用方负责只传入当前用户的数据。
export const searchBook = ({ query, book, volumes = [], chapters = [], cards = [], foreshadows = [] }) => {
  const q = cleanQuery(query)
  if (!q) return []
  const hits = []
  const counts = { prose: 0, summary: 0, outline: 0, card: 0, foreshadow: 0 }
  const add = (group, text, extra) => {
    if (counts[group] >= LIMITS[group]) return
    const snippet = findSnippet(text, q)
    if (!snippet) return
    counts[group] += 1
    hits.push(hit({ ...extra, snippet }))
  }
  const chapterTitle = (chapter) => `第 ${chapter.number} 章 ${chapter.title || ''}`.trim()

  if (book?.world && book.world !== DEFAULT_WORLD) add('outline', book.world, { page: 'outline', kind: 'world', label: '世界观', title: '世界观', outline_type: 'world' })
  if (book?.outline && book.outline !== DEFAULT_OUTLINE) add('outline', book.outline, { page: 'outline', kind: 'book', label: '总纲', title: '总纲', outline_type: 'outline' })

  for (const volume of volumes) {
    const base = { page: 'outline', outline_type: 'volume', outline_id: volume.id, title: volume.title || '未命名卷' }
    add('outline', volume.title, { ...base, kind: 'volume', label: '卷名' })
    add('outline', volume.goal, { ...base, kind: 'volume', label: '本卷目标' })
    add('outline', volume.outline, { ...base, kind: 'volume', label: '分卷大纲' })
  }

  for (const chapter of chapters) {
    const title = chapterTitle(chapter)
    add('prose', chapter.content, { page: 'write', kind: 'prose', label: '正文', title, chapter_id: chapter.id, paragraph: paragraphOf(chapter.content, q) })
    add('summary', chapter.summary, { page: 'write', kind: 'summary', label: '摘要', title, chapter_id: chapter.id })
    const outlineBase = { page: 'outline', outline_type: 'chapter', outline_id: chapter.id, title }
    add('outline', chapter.title, { ...outlineBase, kind: 'chapter', label: '章节标题' })
    add('outline', chapter.goal, { ...outlineBase, kind: 'chapter', label: '本章目标' })
    add('outline', chapter.conflict, { ...outlineBase, kind: 'chapter', label: '冲突' })
    add('outline', chapter.payoff, { ...outlineBase, kind: 'chapter', label: '爽点' })
    add('outline', chapter.hook, { ...outlineBase, kind: 'chapter', label: '章末钩子' })
    const names = Array.isArray(chapter.characters) ? chapter.characters.filter(Boolean).join('、') : ''
    add('outline', names, { ...outlineBase, kind: 'chapter', label: '出场人物' })
  }

  for (const card of cards) {
    const pieces = [['名称', card.name], ['别名', card.aliases]]
    if (card.kind === 'setting') {
      pieces.push(['分类', card.category], ['内容', card.data?.content])
    } else {
      for (const [key, label] of [...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS]) pieces.push([label, card.data?.[key]])
      for (const relation of card.data?.relations || []) pieces.push([`关系·${relation.name}`, `${relation.name} ${relation.desc || ''}`])
    }
    let used = 0
    for (const [label, text] of pieces) {
      if (used >= 2 || counts.card >= LIMITS.card) break
      const before = hits.length
      add('card', text, {
        page: 'memory',
        kind: card.kind === 'setting' ? 'setting' : 'character',
        label: `${card.kind === 'setting' ? '设定' : '人物'}·${label}`,
        title: card.name || '未命名',
        card: card.name || ''
      })
      if (hits.length > before) used += 1
    }
  }

  for (const item of foreshadows) {
    const title = `${item.code || ''} ${item.content || ''}`.trim()
    add('foreshadow', item.content, { page: 'foreshadows', kind: 'foreshadow', label: '伏笔', title, foreshadow_id: item.id })
    add('foreshadow', item.note, { page: 'foreshadows', kind: 'foreshadow', label: '伏笔备注', title, foreshadow_id: item.id })
    add('foreshadow', (item.characters || []).join('、'), { page: 'foreshadows', kind: 'foreshadow', label: '伏笔人物', title, foreshadow_id: item.id })
  }

  return hits
}
