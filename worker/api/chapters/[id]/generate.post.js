import { sql } from 'drizzle-orm'
import { db, getDb, runWithDbInstance } from '../../../db.js'
import { getEnv, runWithEnv } from '../../../env.js'
import { cjHandler, CjError, countWords, getBook, getChapter, paramId, readBody, touchBook } from '../../../lib/common.js'
import { buildContext, contextSummary } from '../../../lib/memory.js'
import { buildContinueMessages, buildGenerateMessages } from '../../../lib/prompts.js'
import { resolveTask, streamCompletion } from '../../../lib/llm.js'
import { currentLocalKeys, redactSecrets, runWithLocalKeys } from '../../../lib/local-keys.js'
import { armDisconnectBudget, keepAfterResponse, runGenerateSession } from '../../../lib/generate-session.js'
import { encodeNdjson } from '../../../../shared/ndjson.js'

// POST /api/changjuan/chapters/:id/generate - 按细纲流式生成正文（mode = full 整章重写 / continue 接着写）
// 返回 NDJSON：context → reasoning… → delta… → done | error。
// 读模型和落库放在 waitUntil 里。客户端断开后不再往外写，模型继续读；结束、出错或超时都把已有正文存成草稿。
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  const book = (await getBook(auth.id, chapter.book_id))
  const body = await readBody(event)
  if (chapter.status === 'confirmed') throw new CjError(409, '本章已确认，要重新生成请先撤销本章确认')
  const mode = body.mode === 'continue' && chapter.content.trim() ? 'continue' : 'full'
  ;(await resolveTask('generate', auth.id))

  const context = (await buildContext(book, chapter))
  const messages = mode === 'continue'
    ? buildContinueMessages({ book, chapter, context, existing: chapter.content })
    : buildGenerateMessages({ book, chapter, context, worldText: book.world })
  const injected = contextSummary(context)
  const encoder = new TextEncoder()
  const abort = new AbortController()
  const budget = armDisconnectBudget(abort)
  // 响应体在 fetch 返回后才被拉取，AsyncLocalStorage 不会自动跟着走。
  // 本机密钥只用这次请求带来的那份 Map，不写入数据库，也不放到全局缓存。
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
  // 客户端取消响应体时，这里会拒绝。不要因此中止模型。
  // Node 的 WritableStream 没有 closed，用 writer.closed。Workers 上两者都有。
  ;(writable.closed || writer.closed).catch(() => markClientClosed())

  const task = runWithEnv(requestEnv, () => runWithDbInstance(requestDb, () => runWithLocalKeys(requestKeys, async () => {
    try {
      await runGenerateSession({
        mode,
        existingContent: chapter.content,
        chapterNumber: chapter.number,
        injected,
        signal: abort.signal,
        send,
        countWords,
        streamCompletion: ({ signal, onDelta, onReasoning }) => streamCompletion({
          task: 'generate',
          messages,
          userId: auth.id,
          bookId: book.id,
          chapterId: chapter.id,
          signal,
          maxTokens: 16384,
          onReasoning,
          onDelta
        }),
        save: async ({ content, promptTokens, model }) => {
          ;(await db.run(sql`
            UPDATE cj_chapters SET content = ${content}, generated_content = ${content}, check_dirty = 1,
              injected = ${JSON.stringify({ ...injected, prompt_tokens: promptTokens, model })},
              updated_at = datetime('now', '+8 hours')
            WHERE id = ${chapter.id} AND user_id = ${auth.id}
          `))
          try {
            ;(await touchBook(book.id, auth.id))
          } catch (err) {
            console.error('[NovelForge] failed to update book timestamp:', err)
          }
        }
      })
    } catch (err) {
      console.error('[NovelForge] generation failed:', redactSecrets(err?.message || ''))
    } finally {
      finishClient()
    }
  })))
  keepAfterResponse(event.executionCtx, task)
  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }
  })
})
