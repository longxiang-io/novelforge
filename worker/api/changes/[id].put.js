import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, getChapter, paramId, readBody, toInt } from '../../lib/common.js'

// PUT /api/changjuan/changes/:id - 接受 / 修改 / 拒绝 / 撤销一条记忆库改动
export default cjHandler(async (event, auth) => {
  const id = paramId(event)
  const change = (await db.get(sql`SELECT * FROM cj_changes WHERE id = ${id} AND user_id = ${auth.id}`))
  if (!change) throw new CjError(404, '改动不存在或无权访问')
  const chapter = (await getChapter(auth.id, change.chapter_id))
  if (chapter.status === 'confirmed') throw new CjError(409, '本章已确认，不能再修改改动')
  const body = await readBody(event)
  const decision = ['pending', 'accepted', 'rejected'].includes(body.decision) ? body.decision : change.decision
  let newValue = change.new_value
  let edited = change.edited
  if (body.new_value !== undefined) {
    const value = String(body.new_value || '').trim().slice(0, 1000)
    if (!value) throw new CjError(400, '改动内容不能为空')
    if (value !== change.new_value) { newValue = value; edited = 1 }
  }
  let payload = change.payload
  if (body.planned_chapter !== undefined && change.kind === 'new_foreshadow') {
    const data = JSON.parse(change.payload || '{}')
    data.planned_chapter = toInt(body.planned_chapter, null)
    payload = JSON.stringify(data)
    edited = 1
  }
  ;(await db.run(sql`UPDATE cj_changes SET decision = ${decision}, new_value = ${newValue}, edited = ${edited}, payload = ${payload} WHERE id = ${id} AND user_id = ${auth.id}`))
  return { code: 200, message: '已更新' }
})
