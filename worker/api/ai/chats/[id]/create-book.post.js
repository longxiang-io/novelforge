import { db } from '../../../../db.js'
import { cjHandler, CjError, paramId, readBody } from '../../../../lib/common.js'
import { createdFromBatch, getChat, getChatMessage, planCreateBook } from '../../../../lib/assist-apply.js'

// POST /api/changjuan/ai/chats/:id/create-book - 用勾选过的建书方案一次建出书、卷、细纲和卡片。
export default cjHandler(async (event, auth) => {
  const chat = await getChat(auth.id, paramId(event))
  const body = await readBody(event)
  const message = await getChatMessage(auth.id, chat.id, Number(body.message_id) || 0)
  if (message.role !== 'assistant') throw new CjError(400, '只能应用 AI 的回复')
  const plan = await planCreateBook({
    userId: auth.id,
    chat,
    message,
    suggestionId: String(body.suggestion_id || ''),
    plan: body.plan && typeof body.plan === 'object' ? body.plan : null
  })
  const results = await db.batch(plan.statements)
  const bookId = Number(results[plan.bookAt]?.lastInsertRowid) || 0
  return { code: 200, message: '已创建', data: { id: bookId, created: createdFromBatch(plan.newRows, results) } }
})
