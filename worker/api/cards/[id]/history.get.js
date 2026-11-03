import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, getCard, paramId, parseJson } from '../../../lib/common.js'
import { fieldLabel } from '../../../lib/memory.js'

// GET /api/changjuan/cards/:id/history - 卡片改动记录：已确认版本里的改动 + 未确认章节里的待确认改动
export default cjHandler(async (event, auth) => {
  const card = (await getCard(auth.id, paramId(event)))
  const type = card.kind === 'setting' ? 'setting' : 'character'
  const records = []
  const pending = (await db.all(sql`
    SELECT c.*, ch.number FROM cj_changes c JOIN cj_chapters ch ON ch.id = c.chapter_id
    WHERE c.book_id = ${card.book_id} AND c.user_id = ${auth.id} AND ch.user_id = ${auth.id} AND ch.status != 'confirmed' AND c.target_name = ${card.name} AND c.decision != 'rejected'
    ORDER BY ch.number DESC, c.id
  `))
  for (const row of pending) {
    records.push({ chapter_number: row.number, field_label: fieldLabel(row.field), old: row.old_value, new: row.new_value, state: row.kind === 'state' ? 'auto_pending' : 'pending' })
  }
  const versions = (await db.all(sql`SELECT id, chapter_number, changes, created_at FROM cj_versions WHERE book_id = ${card.book_id} AND user_id = ${auth.id} AND reverted = 0 ORDER BY id DESC`))
  for (const version of versions) {
    for (const item of parseJson(version.changes, [])) {
      if (item.target_type !== type || item.target_id !== card.id) continue
      records.push({ version_id: version.id, chapter_number: version.chapter_number, field_label: item.field_label, old: item.old, new: item.new, state: item.kind === 'state' ? 'auto' : 'confirmed', created_at: version.created_at })
    }
  }
  return { code: 200, data: records }
})
