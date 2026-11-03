import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { CjError, parseJson } from './common.js'

export const getVersion = async (userId, id) => {
  const version = (await db.get(sql`SELECT * FROM cj_versions WHERE id = ${id} AND user_id = ${userId}`))
  if (!version) throw new CjError(404, '版本不存在或无权访问')
  return version
}

// 只有本书最新一个未撤销的版本可以整体撤销（后面章节已确认时必须先撤销后面的）
export const latestActiveVersionId = async (bookId, userId) => (await db.get(sql`SELECT id FROM cj_versions WHERE book_id = ${bookId} AND user_id = ${userId} AND reverted = 0 ORDER BY id DESC LIMIT 1`))?.id || null

export const versionDetail = async (version) => {
  const changes = parseJson(version.changes, [])
  const groups = []
  for (const item of changes) {
    let group = groups.find(entry => entry.target_type === item.target_type && entry.target_id === item.target_id)
    if (!group) {
      group = { target_type: item.target_type, target_id: item.target_id, target_name: item.target_name, created: !!item.created, items: [] }
      groups.push(group)
    }
    group.items.push({ field_label: item.field_label, old: item.old, new: item.new, kind: item.kind, edited: item.edited })
  }
  const latest = (await latestActiveVersionId(version.book_id, version.user_id))
  return {
    id: version.id,
    chapter_id: version.chapter_id,
    chapter_number: version.chapter_number,
    label: version.label,
    created_at: version.created_at,
    reverted: version.reverted,
    reverted_at: version.reverted_at,
    stats: parseJson(version.stats, {}),
    groups,
    word_count: String(version.content || '').replace(/\s+/g, '').length,
    can_revert: !version.reverted && latest === version.id,
    later_confirmed: !version.reverted && latest !== version.id
  }
}
