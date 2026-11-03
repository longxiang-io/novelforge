import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, cleanList, getForeshadow, paramId, readBody, toInt } from '../../lib/common.js'

// PUT /api/changjuan/foreshadows/:id - 修改伏笔、标记回收或放弃
export default cjHandler(async (event, auth) => {
  const row = (await getForeshadow(auth.id, paramId(event)))
  const body = await readBody(event)
  const content = body.content !== undefined ? String(body.content || '').trim().slice(0, 500) : row.content
  if (!content) throw new CjError(400, '伏笔内容不能为空')
  const status = ['open', 'resolved', 'abandoned'].includes(body.status) ? body.status : row.status
  const resolved = status === 'resolved' ? toInt(body.resolved_chapter, row.resolved_chapter) : null
  ;(await db.run(sql`
    UPDATE cj_foreshadows SET content = ${content},
      characters = ${body.characters !== undefined ? JSON.stringify(cleanList(body.characters, 20)) : row.characters},
      planted_chapter = ${body.planted_chapter !== undefined ? toInt(body.planted_chapter, null) : row.planted_chapter},
      planned_chapter = ${body.planned_chapter !== undefined ? toInt(body.planned_chapter, null) : row.planned_chapter},
      status = ${status}, resolved_chapter = ${resolved},
      note = ${body.note !== undefined ? String(body.note || '').slice(0, 500) : row.note},
      updated_at = datetime('now', '+8 hours')
    WHERE id = ${row.id} AND user_id = ${auth.id}
  `))
  return { code: 200, message: '已保存' }
})
