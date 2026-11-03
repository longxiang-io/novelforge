import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { CjError, cleanList, cleanText, toInt } from './common.js'

// 细纲字段的校验与归一，新建和修改章节共用
export const readOutlineFields = async (body, current, book) => {
  const next = { ...current }
  if (body.title !== undefined) next.title = String(body.title || '').trim().slice(0, 60)
  for (const key of ['goal', 'conflict', 'payoff', 'hook']) {
    if (body[key] !== undefined) next[key] = cleanText(body[key], 2000)
  }
  if (body.characters !== undefined) next.characters = JSON.stringify(cleanList(body.characters, 30))
  if (body.foreshadows !== undefined) {
    const ids = (Array.isArray(body.foreshadows) ? body.foreshadows : []).map(item => toInt(item, 0)).filter(Boolean)
    const valid = ids.length ? (await db.all(sql`SELECT id FROM cj_foreshadows WHERE book_id = ${book.id} AND user_id = ${book.user_id}`)).map(row => row.id) : []
    next.foreshadows = JSON.stringify(ids.filter(id => valid.includes(id)).filter((id, index, list) => list.indexOf(id) === index))
  }
  if (body.target_words !== undefined) {
    const words = toInt(body.target_words, null)
    next.target_words = words ? Math.min(Math.max(words, 300), 20000) : null
  }
  if (body.volume_id !== undefined) {
    const volumeId = toInt(body.volume_id, null)
    if (volumeId && !(await db.get(sql`SELECT id FROM cj_volumes WHERE id = ${volumeId} AND book_id = ${book.id} AND user_id = ${book.user_id}`))) throw new CjError(400, '分卷不存在')
    next.volume_id = volumeId
  }
  if (body.number !== undefined) {
    const number = toInt(body.number, 0)
    if (!number || number < 1 || number > 100000) throw new CjError(400, '章号不正确')
    const clash = (await db.get(sql`SELECT id FROM cj_chapters WHERE book_id = ${book.id} AND user_id = ${book.user_id} AND number = ${number} AND id != ${current.id || 0}`))
    if (clash) throw new CjError(400, `第 ${number} 章已存在`)
    next.number = number
  }
  return next
}
