import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, getChapter, paramId } from '../../lib/common.js'

// DELETE /api/changjuan/chapters/:id - 删除未确认的章节
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  if (chapter.status === 'confirmed') throw new CjError(409, '已确认的章节不能删除，请先撤销本章确认')
  ;(await db.batch([
    sql`DELETE FROM cj_issues WHERE chapter_id = ${chapter.id} AND user_id = ${auth.id}`,
    sql`DELETE FROM cj_changes WHERE chapter_id = ${chapter.id} AND user_id = ${auth.id}`,
    sql`DELETE FROM cj_chapters WHERE id = ${chapter.id} AND user_id = ${auth.id}`
  ]))
  return { code: 200, message: '已删除' }
})
