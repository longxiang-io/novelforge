import { characterToText, mentionedIn, settingToText } from './memory.js'

// 参考材料的长度上限。超了就先砍世界观和远处的章，置顶设定尽量留下。
export const ASSIST_CONTEXT_LIMITS = { maxChars: 12000, neighbor: 3, maxCards: 12 }

const outlineOf = (chapter) => [chapter?.title, chapter?.goal, chapter?.conflict, chapter?.payoff, chapter?.hook].filter(Boolean).join('\n')

const chapterLine = (chapter) => {
  const lines = [`第 ${chapter.number} 章《${chapter.title || '未命名'}》`]
  if (chapter.goal) lines.push(`目标：${chapter.goal}`)
  if (chapter.conflict) lines.push(`冲突：${chapter.conflict}`)
  if (chapter.payoff) lines.push(`爽点：${chapter.payoff}`)
  if (chapter.hook) lines.push(`钩子：${chapter.hook}`)
  if (chapter.characters?.length) lines.push(`出场：${chapter.characters.join('、')}`)
  if (chapter.summary) lines.push(`摘要：${chapter.summary}`)
  else if (chapter.status === 'confirmed') lines.push('已确认，暂无摘要')
  else lines.push('未确认，正文不放入对话')
  return lines.join('\n')
}

export const contextPhrase = ({ targetType, cards, neighborChapters, trimmed }) => {
  if (!cards && !neighborChapters && !trimmed) return ''
  const head = targetType === 'chapter'
    ? `已带上 ${cards} 张卡片、前后 ${neighborChapters} 章`
    : `已带上 ${cards} 张卡片、前后 ${neighborChapters} 章`
  return trimmed ? `${head}（上下文已裁剪）` : head
}

const pickNeighbors = (chapters, focus, targetType, targetId, radius) => {
  const sorted = [...(chapters || [])].sort((a, b) => a.number - b.number)
  if (targetType === 'chapter' && focus) {
    const index = sorted.findIndex(item => item.id === focus.id)
    return [...sorted.slice(Math.max(0, index - radius), index), ...sorted.slice(index + 1, index + 1 + radius)]
  }
  if (targetType === 'volume') return sorted.filter(item => item.volume_id === targetId).slice(0, 12)
  return sorted.slice(-6)
}

const pickCards = (cards, blob, maxCards) => {
  const picked = []
  const push = (card) => { if (card && !picked.includes(card)) picked.push(card) }
  for (const card of cards || []) if (card.kind === 'setting' && card.data?.pinned) push(card)
  for (const card of cards || []) if (card.kind === 'character' && /主角/.test(card.data?.role || '')) push(card)
  for (const card of cards || []) if (mentionedIn(card, blob)) push(card)
  const pinned = picked.filter(card => card.kind === 'setting' && card.data?.pinned)
  const rest = picked.filter(card => !pinned.includes(card)).slice(0, Math.max(0, maxCards - pinned.length))
  return { cards: [...pinned, ...rest], trimmed: pinned.length + rest.length < picked.length }
}

// 只放细纲和摘要。调用方不要把章节正文字段放进 scope。
export const buildAssistContext = (scope, { targetType, targetId, limits = ASSIST_CONTEXT_LIMITS } = {}) => {
  if (!scope?.book) {
    return {
      text: '【新书构思】还没有书。请从题材、卖点、主角、世界观、金手指、核心冲突和开篇聊起。信息不够就继续追问，够了再给出建书建议。',
      cards: 0,
      neighborChapters: 0,
      trimmed: false
    }
  }
  const book = scope.book
  const chapters = scope.chapters || []
  const focus = targetType === 'chapter' ? chapters.find(item => item.id === targetId) : null
  const volume = targetType === 'volume'
    ? (scope.volumes || []).find(item => item.id === targetId)
    : (scope.volumes || []).find(item => item.id === focus?.volume_id)
  let neighbors = pickNeighbors(chapters, focus, targetType, targetId, limits.neighbor)
  const blob = [
    book.title, book.world, book.outline,
    volume?.title, volume?.goal, volume?.outline,
    outlineOf(focus),
    ...neighbors.map(outlineOf)
  ].join('\n')
  const picked = pickCards(scope.cards || [], blob, limits.maxCards)
  let cards = picked.cards
  let world = String(book.world || '')
  let outline = String(book.outline || '')
  let trimmed = picked.trimmed

  const render = () => {
    const parts = [`【书名】${book.title || '未命名'}`]
    if (cards.length) parts.push(`【人物和设定】\n${cards.map(card => card.kind === 'setting' ? settingToText(card) : characterToText(card)).join('\n\n')}`)
    if (focus) parts.push(`【正在聊的章节】\n${chapterLine(focus)}`)
    if (volume) parts.push(`【分卷】${volume.title || ''}\n目标：${volume.goal || '（未填写）'}\n${volume.outline || ''}`)
    if (neighbors.length) parts.push(`【相邻章节，只有细纲和摘要】\n${neighbors.map(chapterLine).join('\n\n')}`)
    if (world) parts.push(`【世界观】\n${world}`)
    if (outline) parts.push(`【总纲】\n${outline}`)
    return parts.join('\n\n')
  }

  const over = () => render().length > limits.maxChars
  if (over()) {
    trimmed = true
    while (over() && world.length > 600) world = world.slice(0, Math.floor(world.length / 2))
    while (over() && outline.length > 600) outline = outline.slice(0, Math.floor(outline.length / 2))
    while (over() && neighbors.length) neighbors = neighbors.slice(0, -1)
    while (over() && cards.some(card => !(card.kind === 'setting' && card.data?.pinned))) {
      const index = cards.findLastIndex(card => !(card.kind === 'setting' && card.data?.pinned))
      cards = cards.filter((_, item) => item !== index)
    }
  }
  let text = render()
  if (text.length > limits.maxChars) {
    trimmed = true
    text = text.slice(0, limits.maxChars)
  }
  return { text, cards: cards.length, neighborChapters: neighbors.length, trimmed }
}
