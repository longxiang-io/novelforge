import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, paramId, parseJson } from '../../../lib/common.js'
import { revertStatements } from '../../../lib/memory.js'
import { revertAssistStatements } from '../../../lib/assist-apply.js'
import { getVersion, latestActiveVersionId } from '../../../lib/versions.js'

// POST /api/changjuan/versions/:id/revert
// 确认版本：卡片回到确认前，正文保留，章节回到未确认。
// AI 修改：只还原大纲、细纲和卡片，不改章节是否已确认，也不改正文。
export default cjHandler(async (event, auth) => {
  const version = (await getVersion(auth.id, paramId(event)))
  if (version.reverted) throw new CjError(409, '这个版本已经撤销过了')
  if ((await latestActiveVersionId(version.book_id, auth.id)) !== version.id) throw new CjError(409, '后面还有还没撤销的版本，请先撤销最新的一条')
  const assist = parseJson(version.stats, {}).source === 'assist' || Number(version.chapter_id) === 0
  const statements = assist ? revertAssistStatements(auth.id, version) : [
    ...revertStatements(auth.id, version),
    sql`UPDATE cj_books SET updated_at = datetime('now', '+8 hours') WHERE id = ${version.book_id} AND user_id = ${auth.id}`
  ]
  ;(await db.batch(statements))
  return { code: 200, message: `已撤销「${version.label}」` }
})
