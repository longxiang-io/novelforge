import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, paramId } from '../../../lib/common.js'
import { getChat } from '../../../lib/assist-apply.js'

// DELETE /api/changjuan/ai/chats/:id - 删掉这段对话和里面的消息。
export default cjHandler(async (event, auth) => {
  const chat = await getChat(auth.id, paramId(event))
  await db.batch([
    sql`DELETE FROM cj_ai_messages WHERE chat_id = ${chat.id} AND user_id = ${auth.id}`,
    sql`DELETE FROM cj_ai_chats WHERE id = ${chat.id} AND user_id = ${auth.id}`
  ])
  return { code: 200, message: '已删除' }
})
