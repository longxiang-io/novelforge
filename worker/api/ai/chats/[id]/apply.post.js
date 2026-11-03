import { db } from '../../../../db.js'
import { cjHandler, CjError, paramId, readBody } from '../../../../lib/common.js'
import { createdFromBatch, getChat, getChatMessage, loadAssistScope, planAssistApply, presentSuggestions } from '../../../../lib/assist-apply.js'

// POST /api/changjuan/ai/chats/:id/apply - 用户点了应用才写入。一次 batch，失败就全部不改。
export default cjHandler(async (event, auth) => {
  const chat = await getChat(auth.id, paramId(event))
  const body = await readBody(event)
  const message = await getChatMessage(auth.id, chat.id, Number(body.message_id) || 0)
  if (message.role !== 'assistant') throw new CjError(400, '只能应用 AI 的回复')
  const scope = await loadAssistScope(auth.id, chat.book_id, { allowNewBook: chat.target_type === 'new_book' && !chat.book_id })
  const plan = await planAssistApply({
    userId: auth.id,
    chat,
    message,
    ids: body.ids,
    all: !!body.all,
    ignoreIds: body.ignore_ids,
    edits: body.edits && typeof body.edits === 'object' ? body.edits : null
  })
  const suggestions = presentSuggestions(plan.suggestions, scope)
  const results = await db.batch(plan.statements)
  return { code: 200, message: '已应用', data: { suggestions, created: createdFromBatch(plan.newRows, results) } }
})
