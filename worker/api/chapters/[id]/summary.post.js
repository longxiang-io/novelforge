import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, getBook, getChapter, paramId } from '../../../lib/common.js'
import { generateSummary } from '../../../lib/workflow.js'

// POST /api/changjuan/chapters/:id/summary - 重新生成已确认章节的摘要
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  ;(await getBook(auth.id, chapter.book_id))
  if (chapter.status !== 'confirmed') throw new CjError(409, '章节确认后才会生成摘要')
  const summary = await (await generateSummary(auth.id, chapter))
  ;(await db.run(sql`UPDATE cj_chapters SET summary = ${summary} WHERE id = ${chapter.id} AND user_id = ${auth.id}`))
  return { code: 200, message: '摘要已生成', data: { summary } }
})
