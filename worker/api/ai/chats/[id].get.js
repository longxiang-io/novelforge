import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, paramId, parseJson } from '../../../lib/common.js'
import { buildAssistContext, contextPhrase } from '../../../lib/assist-context.js'
import { describeAssistModel } from '../../../lib/llm.js'
import { getChat, loadAssistScope, presentSuggestions } from '../../../lib/assist-apply.js'

// GET /api/changjuan/ai/chats/:id - 对话、建议和这次会带上的上下文说明。
export default cjHandler(async (event, auth) => {
  const chat = await getChat(auth.id, paramId(event))
  const allowNewBook = chat.target_type === 'new_book' && !chat.book_id
  const scope = await loadAssistScope(auth.id, chat.book_id, { allowNewBook })
  if (chat.book_id && !scope) throw new CjError(404, '书不存在或无权访问')
  const context = buildAssistContext(scope, { targetType: chat.target_type, targetId: chat.target_id })
  const messages = await db.all(sql`
    SELECT id, role, content, suggestions, prompt_tokens, completion_tokens, cost, created_at
    FROM cj_ai_messages WHERE chat_id = ${chat.id} AND user_id = ${auth.id} ORDER BY id
  `)
  const model = await describeAssistModel(auth.id)
  return {
    code: 200,
    data: {
      ...chat,
      messages: messages.map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        suggestions: presentSuggestions(parseJson(row.suggestions, []), scope),
        prompt_tokens: row.prompt_tokens,
        completion_tokens: row.completion_tokens,
        cost: row.cost,
        created_at: row.created_at
      })),
      context: {
        phrase: contextPhrase({
          targetType: chat.target_type,
          cards: context.cards,
          neighborChapters: context.neighborChapters,
          trimmed: context.trimmed
        }),
        cards: context.cards,
        neighbor_chapters: context.neighborChapters,
        trimmed: context.trimmed
      },
      model: { ready: model.ready, fallback: model.fallback, source: model.source, model: model.model }
    }
  }
})
