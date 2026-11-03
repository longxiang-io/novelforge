// 模型读取、落库和写给客户端的流是分开的。
// 客户端断开只停止往外写，不中断读取。waitUntil 在断开后大约还能再跑 30 秒，提前停下来把已有正文写入。
export const WAIT_UNTIL_AFTER_DISCONNECT_MS = 25_000

export const guardSend = (send) => {
  let closed = false
  return (payload) => {
    if (closed || typeof send !== 'function') return
    try {
      const result = send(payload)
      if (result && typeof result.catch === 'function') result.catch(() => { closed = true })
    } catch {
      closed = true
    }
  }
}

// 断开后再计时。重复调用不会再开一个计时器。
export const armDisconnectBudget = (abort, ms = WAIT_UNTIL_AFTER_DISCONNECT_MS) => {
  let timer = null
  return {
    arm() {
      if (timer) return
      timer = setTimeout(() => abort.abort(), ms)
    },
    clear() {
      if (!timer) return
      clearTimeout(timer)
      timer = null
    }
  }
}

export const keepAfterResponse = (ctx, task) => {
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(task)
  return task
}

const draftContent = (mode, existingContent, piece) => (
  mode === 'continue' ? `${String(existingContent || '').replace(/\s+$/, '')}\n${piece}` : piece
)

// 读完（或模型出错、或中途失败但已有正文）后按调用方给的 save 存草稿。send 失败不往外抛。
export const runGenerateSession = async ({
  mode,
  existingContent,
  chapterNumber,
  injected,
  streamCompletion,
  save,
  send,
  signal,
  countWords
}) => {
  const emit = guardSend(send)
  let assembled = ''
  const wordsOf = (text) => countWords(String(text || ''))
  const persist = async (piece, result) => {
    const trimmed = String(piece || '').trim()
    if (!trimmed) return false
    await save({
      piece: trimmed,
      content: draftContent(mode, existingContent, trimmed),
      promptTokens: Number(result?.usage?.prompt_tokens) || 0,
      model: result?.model || ''
    })
    return true
  }
  const sendFailure = (err, saved, piece) => {
    const words = saved ? wordsOf(mode === 'continue' ? `${existingContent}${piece}` : piece) : wordsOf(existingContent)
    emit({
      type: 'error',
      error_type: err?.extra?.error_type || 'unknown',
      message: err?.message || '生成失败',
      saved,
      words,
      cost: err?.cost,
      detail: saved
        ? `已生成 ${wordsOf(piece)} 字，已保存为草稿，可以接着生成或重来。`
        : `第 ${chapterNumber} 章没有写入任何内容，记忆库没动。`
    })
  }
  const savePiece = async (piece, result) => {
    try {
      return await persist(piece, result)
    } catch (err) {
      console.error('[NovelForge] failed to save generation draft:', err)
      return false
    }
  }

  emit({ type: 'context', data: injected })
  let result
  try {
    result = await streamCompletion({
      signal,
      onReasoning: (text) => emit({ type: 'reasoning', text }),
      onDelta: (text) => {
        assembled += text
        emit({ type: 'delta', text })
      }
    })
  } catch (err) {
    const piece = assembled.trim()
    const saved = piece ? await savePiece(piece, null) : false
    sendFailure(err, saved, piece)
    return { saved, piece }
  }

  const piece = String(result?.text || assembled).trim()
  const saved = await savePiece(piece, result)
  const words = saved ? wordsOf(mode === 'continue' ? `${existingContent}${piece}` : piece) : wordsOf(existingContent)
  if (result?.error) {
    emit({
      type: 'error',
      error_type: result.error.extra?.error_type || 'unknown',
      message: result.error.message,
      saved,
      words,
      cost: result.cost,
      detail: saved
        ? `已生成 ${wordsOf(piece)} 字，已保存为草稿，可以接着生成或重来。`
        : `第 ${chapterNumber} 章没有写入任何内容，记忆库没动。`
    })
  } else {
    emit({
      type: 'done',
      aborted: !!result?.aborted,
      saved,
      words,
      cost: result?.cost,
      usage: result?.usage,
      model: result?.model
    })
  }
  return { saved, piece }
}
