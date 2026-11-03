import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { CjError, countWords, parseJson } from './common.js'
import { currentLocalKeys, redactSecrets } from './local-keys.js'
import { decryptSecret, isMaskedInput } from './secret.js'

// 长卷模型调用：统一走 OpenAI 兼容的 /chat/completions，全部在服务端发起
export const TASKS = {
  generate: '生成正文',
  check: '一致性检查',
  extract: '提取记忆库改动',
  summary: '章节摘要',
  assist: '和 AI 聊'
}

// 和 AI 聊没单独选模型时，用生成正文的模型。生成是按大纲写的那一项。
export const ASSIST_FALLBACK_TASK = 'generate'
const REQUEST_TIMEOUT_MS = 120 * 1000
const STREAM_IDLE_TIMEOUT_MS = 60 * 1000

export const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '')

// 任务模型按用户各存一份。旧的全站键 changjuan_tasks 已在迁移里改名为 changjuan_tasks:1。
export const taskSettingKey = (userId) => {
  const id = Number(userId)
  if (!Number.isInteger(id) || id <= 0) return ''
  return `changjuan_tasks:${id}`
}

export const readTaskConfig = async (userId) => {
  const key = taskSettingKey(userId)
  const row = key ? (await db.get(sql`SELECT value FROM cj_settings WHERE key = ${key}`)) : null
  const saved = parseJson(row?.value, {})
  const result = {}
  for (const task of Object.keys(TASKS)) {
    const item = saved[task] || {}
    result[task] = {
      provider_id: Number(item.provider_id) || null,
      model: String(item.model || ''),
      price_in: item.price_in === '' || item.price_in === null || item.price_in === undefined ? null : Number(item.price_in),
      price_out: item.price_out === '' || item.price_out === null || item.price_out === undefined ? null : Number(item.price_out)
    }
  }
  return result
}

export const taskConfigStatement = (userId, config) => {
  const key = taskSettingKey(userId)
  const value = JSON.stringify(config)
  return sql`
    INSERT INTO cj_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT(key) DO UPDATE SET value = ${value}, updated_at = datetime('now', '+8 hours')
  `
}

export const saveTaskConfig = async (userId, config) => {
  ;(await db.run(taskConfigStatement(userId, config)))
}

export class LlmError extends CjError {
  constructor(status, errorType, message) {
    super(status, message, { error_type: errorType })
  }
}

const notConfigured = (task) => new LlmError(400, 'not_configured', `还没有为「${TASKS[task] || task}」配置你自己的模型，请到设置页填写你自己的模型密钥`)

const taskReady = (config) => !!(config?.provider_id && String(config?.model || '').trim())

// 不抛错。面板用它决定要不要提示「暂时使用生成正文的模型」。
export const describeAssistModel = async (userId) => {
  const tasks = await readTaskConfig(userId)
  if (taskReady(tasks.assist)) return { ready: true, fallback: false, source: 'assist', model: tasks.assist.model }
  const fallback = tasks[ASSIST_FALLBACK_TASK]
  if (taskReady(fallback)) return { ready: true, fallback: true, source: ASSIST_FALLBACK_TASK, model: fallback.model }
  return { ready: false, fallback: false, source: '', model: '' }
}

export const localKeyMissing = () => new LlmError(400, 'local_key_missing', '这台设备没有保存密钥，请在设置页填写')

// 只取当前用户自己的服务商。别人的 id 当作不存在。
export const resolveProvider = async (providerId, userId) => {
  const id = Number(providerId) || 0
  const owner = Number(userId) || 0
  if (!id || !owner) return null
  return (await db.get(sql`SELECT * FROM cj_providers WHERE id = ${id} AND user_id = ${owner}`)) || null
}

const paintError = (err, apiKey) => {
  if (!err) return err
  const message = redactSecrets(err.message, apiKey ? [apiKey] : [])
  if (message !== err.message) err.message = message
  return err
}

export const resolveTask = async (task, userId) => {
  const config = (await readTaskConfig(userId))[task]
  if (!config?.provider_id || !config.model) throw notConfigured(task)
  const provider = (await resolveProvider(config.provider_id, userId))
  if (!provider?.base_url) throw notConfigured(task)
  const storage = provider.key_storage === 'local' ? 'local' : 'server'
  let apiKey = ''
  if (storage === 'local') {
    // 本机密钥来自这一次请求的请求头，用完即弃。
    apiKey = currentLocalKeys().get(Number(provider.id)) || ''
    if (!apiKey) throw localKeyMissing()
  } else if (!provider.api_key) {
    throw notConfigured(task)
  } else {
    try {
      apiKey = (await decryptSecret(provider.api_key))
    } catch (err) {
      throw new LlmError(400, 'bad_key', redactSecrets(err.message))
    }
  }
  return {
    ...config,
    baseUrl: normalizeBaseUrl(provider.base_url),
    apiKey,
    providerName: provider.name,
    providerId: provider.id,
    keyStorage: storage
  }
}

// 用量任务始终记 assist。没配「和 AI 聊」时借用生成正文的模型。
export const resolveAssist = async (userId) => {
  const info = await describeAssistModel(userId)
  if (!info.ready) throw notConfigured('assist')
  try {
    const resolved = await resolveTask(info.source, userId)
    return { ...info, resolved, usageTask: 'assist' }
  } catch (err) {
    if (info.fallback && err instanceof LlmError && err.extra?.error_type === 'not_configured') throw notConfigured('assist')
    throw err
  }
}

// 测试和拉模型列表：请求体里的新密钥只在这一次调用里用，不会写回数据库。
export const resolveCallerKey = async ({ userId, providerId, rawKey }) => {
  const id = Number(providerId) || 0
  const stored = id ? (await resolveProvider(id, userId)) : null
  if (id && !stored) throw new CjError(404, '服务商不存在')
  const typed = String(rawKey || '').trim()
  if (typed && !isMaskedInput(typed)) return { apiKey: typed, stored, usingSaved: false }
  if (stored?.key_storage === 'local') {
    const key = currentLocalKeys().get(Number(stored.id)) || ''
    if (!key) throw localKeyMissing()
    return { apiKey: key, stored, usingSaved: true }
  }
  if (!stored?.api_key) throw new CjError(400, '请先填写密钥')
  try {
    return { apiKey: (await decryptSecret(stored.api_key)), stored, usingSaved: true }
  } catch (err) {
    throw new LlmError(400, 'bad_key', redactSecrets(err.message))
  }
}

const extractMessage = (text) => {
  const json = parseJson(text, null)
  return json?.error?.message || json?.message || String(text || '').slice(0, 200)
}

// 上游 HTTP 错误转成作者看得懂的中文提示
export const mapHttpError = (status, bodyText, apiKey) => {
  const detail = redactSecrets(extractMessage(bodyText), apiKey ? [apiKey] : [])
  if (status === 401 || status === 403) return new LlmError(502, 'auth', `密钥无效或没有权限（HTTP ${status}）：${detail}`)
  if (status === 402 || /insufficient|quota|balance|余额|额度/i.test(detail)) return new LlmError(502, 'quota', `额度不足（HTTP ${status}）：${detail}`)
  if (status === 429) return new LlmError(502, 'rate_limit', `请求太频繁，请稍后再试（HTTP 429）：${detail}`)
  if (status === 404) return new LlmError(502, 'not_found', `接口地址或模型码不正确（HTTP 404）：${detail}`)
  if (status >= 500) return new LlmError(502, 'upstream', `模型服务暂时不可用（HTTP ${status}）：${detail}`)
  return new LlmError(502, 'bad_request', `模型请求被拒绝（HTTP ${status}）：${detail}`)
}

export const mapNetworkError = (err, apiKey) => {
  if (err instanceof CjError) return paintError(err, apiKey)
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError' && err?.message?.includes('timeout')) {
    return new LlmError(504, 'timeout', '模型请求超时，请稍后重试或换一个模型')
  }
  const code = err?.cause?.code || err?.code || ''
  if (['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'ECONNRESET', 'CERT_HAS_EXPIRED', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
    return new LlmError(502, 'network', `无法连接接口地址（${code}），请检查接口地址是否正确`)
  }
  return new LlmError(502, 'network', redactSecrets(`网络中断：${err?.message || '未知错误'}`, apiKey ? [apiKey] : []))
}

const estimateTokens = (text) => Math.ceil(String(text || '').length / 1.5)

// 用量只记任务、模型和 token。密钥不进这张表，也不进日志。费用由服务商结算，这里不算价。
const recordUsage = async ({ userId, bookId, chapterId, task, config, promptTokens, completionTokens, outputChars = 0 }) => {
  ;(await db.run(sql`
    INSERT INTO cj_usage (user_id, book_id, chapter_id, task, model, prompt_tokens, completion_tokens, cost, output_chars)
    VALUES (${userId}, ${bookId || null}, ${chapterId || null}, ${task}, ${config.model}, ${promptTokens}, ${completionTokens}, ${null}, ${outputChars})
  `))
  return null
}

const isOpenRouter = (base) => {
  try { return /(^|\.)openrouter\.ai$/i.test(new URL(base).hostname) } catch { return false }
}

// 火山方舟：请求体里的 model 填模型列表里的 Model ID。不读 /models 下拉。
export const isArkBaseUrl = (base) => {
  try { return /^ark\.[a-z0-9-]+\.volces\.com$/i.test(new URL(base).hostname) } catch { return false }
}

// 方舟的深度思考模型默认先想再答，长卷要的是正文和 JSON，默认关掉。
// 不支持该参数的模型会返回 400，调用方去掉后再试一次。
const thinkingUnsupported = (status, bodyText) => {
  if (status !== 400) return false
  const text = String(bodyText || '')
  if (!/thinking/i.test(text)) return false
  return /not support|unsupported|不支持|unknown|invalid|not valid|无法识别|不能识别/i.test(text)
}

const chatRequest = async ({ baseUrl, apiKey, model, body, signal }) => {
  const send = (withThinking) => fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      ...(withThinking ? { thinking: { type: 'disabled' } } : {}),
      ...body
    }),
    signal
  })
  const response = await send(isArkBaseUrl(baseUrl))
  if (!isArkBaseUrl(baseUrl) || response.ok) return response
  const bodyText = await response.text().catch(() => '')
  if (thinkingUnsupported(response.status, bodyText)) return send(false)
  return new Response(bodyText, { status: response.status, statusText: response.statusText })
}

const postChat = async (config, body, signal) => (await chatRequest({
  baseUrl: config.baseUrl,
  apiKey: config.apiKey,
  model: config.model,
  body,
  signal
}))

// 方舟等接口有时把正文放在 content 数组里
const readContent = (content) => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const text = content.map(part => (typeof part === 'string' ? part : part?.text)).filter(item => typeof item === 'string').join('')
  return text
}

// 普通调用，返回 { text, cost, usage }
export const chatCompletion = async ({ task, usageTask, messages, userId, bookId, chapterId, maxTokens = 4096, temperature = 0.3 }) => {
  const config = (await resolveTask(task, userId))
  let response
  try {
    response = await postChat(config, { messages, temperature, max_tokens: maxTokens }, AbortSignal.timeout(REQUEST_TIMEOUT_MS))
  } catch (err) {
    throw mapNetworkError(err, config.apiKey)
  }
  const bodyText = await response.text().catch(() => '')
  if (!response.ok) throw mapHttpError(response.status, bodyText, config.apiKey)
  const json = parseJson(bodyText, null)
  const text = readContent(json?.choices?.[0]?.message?.content)
  if (typeof text !== 'string') throw new LlmError(502, 'bad_response', '模型返回格式不正确，请确认接口是 OpenAI 兼容格式')
  const promptTokens = Number(json.usage?.prompt_tokens) || estimateTokens(messages.map(item => item.content).join(''))
  const completionTokens = Number(json.usage?.completion_tokens) || estimateTokens(text)
  const cost = (await recordUsage({
    userId, bookId, chapterId, task: usageTask || task, config, promptTokens, completionTokens,
    outputChars: task === 'generate' ? countWords(text) : 0
  }))
  return { text, cost, usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens }, model: config.model }
}

// 流式调用：边收边回调 onDelta；中途断开时返回已收到的部分并带上 error
export const streamCompletion = async ({ task, usageTask, resolved, messages, userId, bookId, chapterId, onDelta, onReasoning, signal, maxTokens = 8192, temperature = 0.8 }) => {
  const config = resolved || (await resolveTask(task, userId))
  const controller = new AbortController()
  let idleTimer = null
  let timedOut = false
  const resetIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => { timedOut = true; controller.abort() }, STREAM_IDLE_TIMEOUT_MS)
  }
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  let text = ''
  let reasoningChars = 0
  let finishReason = ''
  let usage = null
  let error = null
  // OpenRouter 上的思考型模型（如 kimi）默认会先长时间思考，调低思考强度，把输出额度留给正文
  const extra = isOpenRouter(config.baseUrl) ? { reasoning: { effort: 'low' } } : {}
  try {
    resetIdle()
    let response
    try {
      response = await postChat(config, { messages, temperature, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true }, ...extra }, controller.signal)
    } catch (err) {
      throw timedOut ? new LlmError(504, 'timeout', '模型长时间没有响应，请稍后重试') : mapNetworkError(err, config.apiKey)
    }
    if (!response.ok) throw mapHttpError(response.status, await response.text().catch(() => ''), config.apiKey)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      let chunk
      try {
        chunk = await reader.read()
      } catch (err) {
        if (signal?.aborted) break
        throw timedOut ? new LlmError(504, 'timeout', '模型长时间没有响应，已停止接收') : mapNetworkError(err, config.apiKey)
      }
      if (chunk.done) break
      resetIdle()
      buffer += decoder.decode(chunk.value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        const json = parseJson(data, null)
        if (json?.usage) usage = json.usage
        const choice = json?.choices?.[0]
        if (choice?.finish_reason) finishReason = choice.finish_reason
        const thinking = choice?.delta?.reasoning || choice?.delta?.reasoning_content
        if (thinking) {
          reasoningChars += thinking.length
          onReasoning?.(thinking)
        }
        const delta = readContent(choice?.delta?.content)
        if (delta) {
          text += delta
          onDelta?.(delta)
        }
      }
    }
    if (!text.trim() && !signal?.aborted) {
      throw reasoningChars && finishReason === 'length'
        ? new LlmError(502, 'reasoning_only', '模型把输出额度都用在思考上，没写出正文。可以再试一次，或在设置里把生成模型换成不带思考的模型')
        : new LlmError(502, 'empty', '模型没有返回正文，请稍后重试或换个模型')
    }
  } catch (err) {
    error = paintError(err instanceof CjError ? err : mapNetworkError(err, config.apiKey), config.apiKey)
  } finally {
    clearTimeout(idleTimer)
    signal?.removeEventListener('abort', onAbort)
  }
  let cost = null
  const promptTokens = Number(usage?.prompt_tokens) || estimateTokens(messages.map(item => item.content).join(''))
  const completionTokens = Number(usage?.completion_tokens) || estimateTokens(text)
  if (text || usage) cost = (await recordUsage({
    userId, bookId, chapterId, task: usageTask || task, config, promptTokens, completionTokens,
    outputChars: (usageTask || task) === 'generate' ? countWords(text) : 0
  }))
  return { text, cost, usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens }, error, aborted: !!signal?.aborted, model: config.model }
}

const MODEL_LIST_LIMIT = 500

// 读取服务商的 /models。列不出模型时 listed 为 false，不当成密钥错误
const readModelCatalog = async (base, apiKey) => {
  const headers = { Authorization: `Bearer ${apiKey}` }
  let response
  try {
    response = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(15000) })
  } catch (err) {
    throw mapNetworkError(err, apiKey)
  }
  if (response.status === 401 || response.status === 403) throw mapHttpError(response.status, await response.text().catch(() => ''), apiKey)
  if (!response.ok) return { listed: false, models: [], truncated: false }
  const json = parseJson(await response.text().catch(() => ''), null)
  const models = Array.isArray(json?.data)
    ? json.data.map(item => {
      const id = String(item?.id || '').trim()
      if (!id) return null
      const name = String(item?.name || '').trim()
      return { id, name: name && name !== id ? name : '' }
    }).filter(Boolean)
    : []
  return { listed: true, models: models.slice(0, MODEL_LIST_LIMIT), truncated: models.length > MODEL_LIST_LIMIT }
}

// 只拉模型列表，供设置页下拉选择。不改连通状态，也不发对话请求。
// 火山方舟的 /models 不是这把密钥能调用的名单，设置页改为手填 Model ID。
export const listProviderModels = async ({ baseUrl, apiKey }) => {
  const base = normalizeBaseUrl(baseUrl)
  if (!/^https?:\/\//i.test(base)) throw new LlmError(400, 'bad_url', '接口地址需要以 http:// 或 https:// 开头')
  if (!apiKey) throw new LlmError(400, 'no_key', '请先填写密钥')
  if (isArkBaseUrl(base)) return { listed: false, models: [], truncated: false }
  return (await readModelCatalog(base, apiKey))
}

// 测试接口地址 + 密钥：先请求 /models，不支持时再发一次极短的对话请求
export const testProvider = async ({ baseUrl, apiKey, model }) => {
  const base = normalizeBaseUrl(baseUrl)
  if (!/^https?:\/\//i.test(base)) throw new LlmError(400, 'bad_url', '接口地址需要以 http:// 或 https:// 开头')
  if (!apiKey) throw new LlmError(400, 'no_key', '请先填写密钥')
  const catalog = await readModelCatalog(base, apiKey)
  if (isArkBaseUrl(base)) {
    if (model) return (await probeModel({ base, apiKey, model }))
    const message = catalog.listed
      ? '已连通。请填写火山方舟模型列表里的 Model ID'
      : '接口地址可访问。请填写火山方舟模型列表里的 Model ID'
    return { ok: true, models: [], truncated: false, message }
  }
  if (catalog.listed) {
    // OpenRouter 的 /models 不校验密钥，另查 /key 确认密钥有效
    if (isOpenRouter(base)) {
      let keyResponse
      try {
        keyResponse = await fetch(`${base}/key`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) })
      } catch (err) {
        throw mapNetworkError(err, apiKey)
      }
      if (!keyResponse.ok) throw mapHttpError(keyResponse.status, await keyResponse.text().catch(() => ''), apiKey)
    }
    const { models } = catalog
    const message = models.length ? `已连通，可选模型 ${models.length} 个` : '已连通。这个接口没有列出模型，请直接填写模型码'
    return { ok: true, models, truncated: catalog.truncated, message }
  }
  if (!model) {
    return { ok: true, models: [], truncated: false, message: '接口地址可访问，但不支持列出模型；选好模型后可再测一次' }
  }
  return (await probeModel({ base, apiKey, model }))
}

// 用模型码发一次极短对话，确认这个码在当前密钥下真的能调用
const probeModel = async ({ base, apiKey, model }) => {
  let response
  try {
    response = await chatRequest({
      baseUrl: base,
      apiKey,
      model,
      body: { messages: [{ role: 'user', content: '只回复：好' }], max_tokens: 16 },
      signal: AbortSignal.timeout(30000)
    })
  } catch (err) {
    throw mapNetworkError(err, apiKey)
  }
  if (!response.ok) throw mapHttpError(response.status, await response.text().catch(() => ''), apiKey)
  return { ok: true, models: [], message: isArkBaseUrl(base) ? '已连通，模型码可用' : '已连通' }
}

// 从模型输出中取出 JSON（兼容 ```json 代码块和前后多余文字）
export const parseModelJson = (text) => {
  const raw = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  const direct = parseJson(raw, null)
  if (direct) return direct
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const sliced = parseJson(raw.slice(start, end + 1), null)
    if (sliced) return sliced
  }
  throw new LlmError(502, 'bad_json', '模型没有按要求返回 JSON，请重试或换一个推理能力更强的模型')
}
