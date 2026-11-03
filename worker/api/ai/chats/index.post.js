import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, readBody } from '../../../lib/common.js'
import { assertChatTarget, getChat } from '../../../lib/assist-apply.js'

// POST /api/changjuan/ai/chats - 给某个对象新开一段对话。还不会调用模型。
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const target = await assertChatTarget(auth.id, body)
  const results = await db.batch([
    sql`
      INSERT INTO cj_ai_chats (user_id, book_id, target_type, target_id, title)
      VALUES (${auth.id}, ${target.book_id}, ${target.target_type}, ${target.target_id}, ${target.title})
    `
  ])
  const chat = await getChat(auth.id, Number(results[0].lastInsertRowid))
  return { code: 200, message: '已创建', data: chat }
})
