import { sql } from 'drizzle-orm'
import { db, getDb, runWithDbInstance } from '../../../../db.js'
import { getEnv, runWithEnv } from '../../../../env.js'
import { cjHandler, CjError, paramId, readBody } from '../../../../lib/common.js'
import { buildAssistContext, contextPhrase } from '../../../../lib/assist-context.js'
import { interpretReply, markerHoldLength, splitSuggestionText } from '../../../../lib/assist-schema.js'
import { getChat, loadAssistScope, presentSuggestions } from '../../../../lib/assist-apply.js'
import { buildAssistMessages } from '../../../../lib/prompts.js'
import { resolveAssist, streamCompletion } from '../../../../lib/llm.js'
import { currentLocalKeys, redactSecrets, runWithLocalKeys } from '../../../../lib/local-keys.js'
import { armDisconnectBudget, keepAfterResponse } from '../../../../lib/generate-session.js'
import { encodeNdjson } from '../../../../../shared/ndjson.js'

const targetLabel = (chat) => {
  if (chat.target_type === 'new_book') return '新书构思'
  if (chat.target_type === 'book') return '全书总纲和世界观'
  if (chat.target_type === 'volume') return '当前卷大纲'
  if (chat.target_type === 'chapter') return '当前章细纲'
  return '当前卡片'
}

// POST /api/changjuan/ai/chats/:id/messages - 流式对话。建议只解析，不写书。
// 客户端断开后不再往外写，模型继续读；结束或出错都把已有回复存下来。
export default cjHandler(async (event, auth) => {
  const chat = await getChat(auth.id, paramId(event))
  const body = await readBody(event)
  const content = String(body.content || '').trim()
  if (!content) throw new CjError(400, '请输入内容')
  if (content.length > 8000) throw new CjError(400, '这句话太长了，请缩短到 8000 字以内')
  // 模型没配好就不要先落下用户的话。
  const assist = await resolveAssist(auth.id)
  const allowNewBook = chat.target_type === 'new_book' && !chat.book_id
  const scope = await loadAssistScope(auth.id, chat.book_id, { allowNewBook })
  if (chat.book_id && !scope) throw new CjError(404, '书不存在或无权访问')
  const context = buildAssistContext(scope, { targetType: chat.target_type, targetId: chat.target_id })
  const titleSeed = content.replace(/\s+/g, ' ').slice(0, 24)
  const inserted = await db.batch([
    sql`INSERT INTO cj_ai_messages (chat_id, user_id, role, content) VALUES (${chat.id}, ${auth.id}, 'user', ${content})`,
    sql`
      UPDATE cj_ai_chats
      SET title = CASE WHEN title = '' THEN ${titleSeed} ELSE title END, updated_at = datetime('now', '+8 hours')
      WHERE id = ${chat.id} AND user_id = ${auth.id}
    `
  ])
  const userMessageId = Number(inserted[0].lastInsertRowid)
  const prior = await db.all(sql`
    SELECT role, content FROM cj_ai_messages
    WHERE chat_id = ${chat.id} AND user_id = ${auth.id} AND id != ${userMessageId}
    ORDER BY id DESC LIMIT 16
  `)
  const messages = buildAssistMessages({
    contextText: context.text,
    targetLabel: targetLabel(chat),
    history: prior.reverse(),
    userText: content
  })

  const encoder = new TextEncoder()
  const abort = new AbortController()
  const budget = armDisconnectBudget(abort)
  const requestDb = getDb()
  const requestEnv = getEnv()
  const requestKeys = currentLocalKeys()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  let clientClosed = false
  let stopped = false
  const markClientClosed = () => {
    clientClosed = true
    if (!stopped) budget.arm()
  }
  const send = (payload) => {
    if (clientClosed) return
    try {
      const pending = writer.write(encoder.encode(encodeNdjson(payload)))
      if (pending && typeof pending.catch === 'function') pending.catch(() => markClientClosed())
    } catch {
      markClientClosed()
    }
  }
  const finishClient = () => {
    stopped = true
    clientClosed = true
    budget.clear()
    writer.close().catch(() => {})
  }
  ;(writable.closed || writer.closed).catch(() => markClientClosed())

  const task = runWithEnv(requestEnv, () => runWithDbInstance(requestDb, () => runWithLocalKeys(requestKeys, async () => {
    let full = ''
    let shown = 0
    try {
      send({ type: 'status', text: '已发送给模型' })
      send({
        type: 'context',
        data: {
          phrase: contextPhrase({
            targetType: chat.target_type,
            cards: context.cards,
            neighborChapters: context.neighborChapters,
            trimmed: context.trimmed
          }),
          cards: context.cards,
          neighbor_chapters: context.neighborChapters,
          trimmed: context.trimmed
        }
      })
      const result = await streamCompletion({
        task: assist.source,
        usageTask: 'assist',
        resolved: assist.resolved,
        messages,
        userId: auth.id,
        bookId: chat.book_id || null,
        chapterId: chat.target_type === 'chapter' ? chat.target_id : null,
        temperature: 0.7,
        maxTokens: 8192,
        signal: abort.signal,
        onReasoning: (text) => send({ type: 'reasoning', text }),
        onDelta: (delta) => {
          full += delta
          const visible = markerHoldLength(full)
          if (visible > shown) {
            send({ type: 'delta', text: full.slice(shown, visible) })
            shown = visible
          }
        }
      })
      const text = result.text || ''
      if (result.aborted && !text.trim()) {
        send({ type: 'error', message: '已停止' })
        return
      }
      let reply = ''
      let suggestions = []
      if (text.trim()) {
        const interpreted = interpretReply(text, chat, scope)
        reply = interpreted.content
        suggestions = interpreted.suggestions
        if (!splitSuggestionText(text).parsed) {
          const rest = text.slice(shown)
          if (rest) send({ type: 'delta', text: rest })
        }
      } else {
        reply = result.error?.message || '模型没有返回内容'
      }
      const saved = await db.batch([
        sql`
          INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions, prompt_tokens, completion_tokens, cost)
          VALUES (${chat.id}, ${auth.id}, 'assistant', ${reply}, ${JSON.stringify(suggestions)},
            ${result.usage?.prompt_tokens || 0}, ${result.usage?.completion_tokens || 0}, ${result.cost ?? null})
        `,
        sql`UPDATE cj_ai_chats SET updated_at = datetime('now', '+8 hours') WHERE id = ${chat.id} AND user_id = ${auth.id}`
      ])
      const messageId = Number(saved[0].lastInsertRowid)
      send({ type: 'suggestions', data: presentSuggestions(suggestions, scope) })
      if (result.error && !result.aborted) send({ type: 'error', message: result.error.message })
      send({ type: 'done', message_id: messageId, content: reply })
    } catch (err) {
      const message = redactSecrets(err?.message || '对话失败')
      console.error('[NovelForge] chat generation failed:', message)
      try {
        await db.run(sql`
          INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
          VALUES (${chat.id}, ${auth.id}, 'assistant', ${message}, '[]')
        `)
      } catch (saveErr) {
        console.error('[NovelForge] failed to save chat:', redactSecrets(saveErr?.message || ''))
      }
      send({ type: 'error', message })
    } finally {
      finishClient()
    }
  })))
  keepAfterResponse(event.executionCtx, task)
  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }
  })
})
