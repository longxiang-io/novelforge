import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { readLocalKeysHeader, redactSecrets, runWithLocalKeys } from './local-keys.js'

// 长卷接口公共工具：统一鉴权、错误返回、归属校验

export class CjError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

// 未知异常只在日志里记录详情，返回给前端的是通用提示和错误编号，避免把 SQL 语句等内部信息带出去
export const internalError = (c, err, label = '接口异常') => {
  const ref = crypto.randomUUID().slice(0, 8)
  console.error(`[NovelForge] ${label} ${ref}:`, redactSecrets(err?.message || ''))
  return c.json({ code: 500, message: `服务器出错了，请稍后再试（错误编号 ${ref}）` }, 500)
}

// 包装处理函数：未登录直接 401，CjError 转成对应状态码，其他异常记录日志后返回 500
export const cjHandler = (handler) => async (c) => {
  const auth = c.get('user')
  if (!auth) return c.json({ code: 401, message: '未登录或登录已过期' }, 401)
  const query = {}
  for (const [key, value] of new URL(c.req.url).searchParams) query[key] = value
  const event = {
    context: { auth, role: auth.role, params: c.req.param() },
    req: c.req.raw,
    query,
    executionCtx: c.executionCtx
  }
  // 本机密钥只放进这次请求的上下文。后台任务要自己带上同一份 Map，不能另做缓存。
  const localKeys = readLocalKeysHeader(c.req.header('x-provider-keys'))
  return runWithLocalKeys(localKeys, async () => {
    try {
      const result = await handler(event, auth)
      if (result instanceof Response) return result
      return c.json(result)
    } catch (err) {
      const message = redactSecrets(err?.message || '')
      if (err instanceof CjError) return c.json({ code: err.status, message, ...(err.extra || {}) }, err.status)
      return internalError(c, err)
    }
  })
}

export const isAdmin = (event) => event.context.role === 'admin'

export const paramId = (event, name = 'id') => {
  const id = Number.parseInt(event.context.params?.[name], 10)
  if (!Number.isInteger(id) || id <= 0) throw new CjError(400, '参数错误')
  return id
}

export const queryOf = (event) => event.query || {}

export const readBody = async (event) => {
  try {
    const body = await event.req.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

export const parseJson = (text, fallback) => {
  if (text === null || text === undefined || text === '') return fallback
  try {
    const value = JSON.parse(text)
    return value ?? fallback
  } catch {
    return fallback
  }
}

export const toInt = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? number : fallback
}

export const cleanText = (value, max = 20000) => String(value ?? '').replace(/\r\n?/g, '\n').slice(0, max)

export const cleanList = (value, max = 50) => (Array.isArray(value) ? value : [])
  .map(item => String(item ?? '').trim())
  .filter(Boolean)
  .filter((item, index, list) => list.indexOf(item) === index)
  .slice(0, max)

// 中文按字数统计：去掉空白后的字符数
export const countWords = (text) => String(text || '').replace(/\s+/g, '').length

// 正文按非空行分段，段号从 1 开始
export const splitParagraphs = (text) => String(text || '').split('\n').map(line => line.trim()).filter(Boolean)

export const getBook = async (userId, bookId) => {
  const book = await db.get(sql`SELECT * FROM cj_books WHERE id = ${bookId} AND user_id = ${userId}`)
  if (!book) throw new CjError(404, '书不存在或无权访问')
  return book
}

export const getChapter = async (userId, chapterId) => {
  const chapter = await db.get(sql`SELECT * FROM cj_chapters WHERE id = ${chapterId} AND user_id = ${userId}`)
  if (!chapter) throw new CjError(404, '章节不存在或无权访问')
  return chapter
}

export const getCard = async (userId, cardId) => {
  const card = await db.get(sql`SELECT * FROM cj_cards WHERE id = ${cardId} AND user_id = ${userId}`)
  if (!card) throw new CjError(404, '卡片不存在或无权访问')
  return card
}

export const getForeshadow = async (userId, id) => {
  const row = await db.get(sql`SELECT * FROM cj_foreshadows WHERE id = ${id} AND user_id = ${userId}`)
  if (!row) throw new CjError(404, '伏笔不存在或无权访问')
  return row
}

export const formatCard = (row) => row && ({ ...row, data: parseJson(row.data, {}) })

export const formatForeshadow = (row) => row && ({ ...row, characters: parseJson(row.characters, []) })

export const formatChapter = (row) => row && ({
  ...row,
  characters: parseJson(row.characters, []),
  foreshadows: parseJson(row.foreshadows, []),
  injected: parseJson(row.injected, null),
  word_count: countWords(row.content)
})

export const touchBook = (bookId, userId) => db.run(sql`UPDATE cj_books SET updated_at = datetime('now', '+8 hours') WHERE id = ${bookId} AND user_id = ${userId}`)

// 按书生成下一个伏笔编号 F001、F002……
export const nextForeshadowCode = async (bookId, userId) => {
  const rows = await db.all(sql`SELECT code FROM cj_foreshadows WHERE book_id = ${bookId} AND user_id = ${userId}`)
  const max = rows.reduce((value, row) => Math.max(value, Number.parseInt(String(row.code).replace(/\D/g, ''), 10) || 0), 0)
  return `F${String(max + 1).padStart(3, '0')}`
}
