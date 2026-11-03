import { CjError } from './common.js'
import { CHARACTER_BASE_FIELDS, CHARACTER_STATE_FIELDS, SETTING_CATEGORIES } from './memory.js'

// 卡片字段白名单，避免任意 JSON 写入
export const readCardInput = (body, current = {}) => {
  const kind = current.kind || (body.kind === 'setting' ? 'setting' : 'character')
  const name = body.name !== undefined ? String(body.name || '').trim().slice(0, 60) : current.name
  if (!name) throw new CjError(400, '名称不能为空')
  const aliases = body.aliases !== undefined ? String(body.aliases || '').trim().slice(0, 200) : (current.aliases || '')
  let category = body.category !== undefined ? String(body.category || '').trim().slice(0, 20) : (current.category || '')
  const source = body.data && typeof body.data === 'object' ? body.data : {}
  const data = { ...(current.data || {}) }
  if (kind === 'character') {
    for (const [key] of [...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS]) {
      if (source[key] !== undefined) data[key] = String(source[key] ?? '').slice(0, 1000)
    }
    if (source.relations !== undefined) {
      data.relations = (Array.isArray(source.relations) ? source.relations : [])
        .map(item => ({ name: String(item?.name || '').trim().slice(0, 60), desc: String(item?.desc || '').trim().slice(0, 300) }))
        .filter(item => item.name)
        .slice(0, 50)
    }
    category = ''
  } else {
    if (source.content !== undefined) data.content = String(source.content ?? '').slice(0, 5000)
    if (source.pinned !== undefined) data.pinned = !!source.pinned
    if (category && !SETTING_CATEGORIES.includes(category)) category = '其他'
  }
  return { kind, name, aliases, category, data }
}
