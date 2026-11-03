import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, cleanText, paramId, readBody, toInt } from '../../lib/common.js'

// PUT /api/changjuan/volumes/:id - 修改分卷名、本卷目标、分卷大纲
export default cjHandler(async (event, auth) => {
  const id = paramId(event)
  const volume = (await db.get(sql`SELECT * FROM cj_volumes WHERE id = ${id} AND user_id = ${auth.id}`))
  if (!volume) throw new CjError(404, '分卷不存在或无权访问')
  const body = await readBody(event)
  const title = body.title !== undefined ? String(body.title || '').trim().slice(0, 60) : volume.title
  if (!title) throw new CjError(400, '卷名不能为空')
  ;(await db.run(sql`
    UPDATE cj_volumes SET title = ${title},
      goal = ${body.goal !== undefined ? cleanText(body.goal, 2000) : volume.goal},
      outline = ${body.outline !== undefined ? cleanText(body.outline, 50000) : volume.outline},
      sort = ${body.sort !== undefined ? toInt(body.sort, volume.sort) : volume.sort}
    WHERE id = ${id} AND user_id = ${auth.id}
  `))
  return { code: 200, message: '已保存' }
})
