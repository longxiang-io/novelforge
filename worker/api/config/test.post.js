import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, readBody, toInt } from '../../lib/common.js'
import { redactSecrets } from '../../lib/local-keys.js'
import { normalizeBaseUrl, resolveCallerKey, testProvider } from '../../lib/llm.js'

// POST /api/changjuan/config/test - 测试自己的接口地址和密钥。
// 请求体或请求头里的密钥只用于这一次调用，不会写进 cj_providers。
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const id = toInt(body.id, 0)
  const { apiKey, stored, usingSaved } = (await resolveCallerKey({ userId: auth.id, providerId: id, rawKey: body.api_key }))
  const baseUrl = normalizeBaseUrl(body.base_url ?? stored?.base_url)
  const sameAsStored = stored && usingSaved && baseUrl === stored.base_url
  try {
    const result = await testProvider({ baseUrl, apiKey, model: String(body.model || '').trim() })
    if (sameAsStored) (await db.run(sql`UPDATE cj_providers SET status = 'ok', last_error = '', tested_at = datetime('now', '+8 hours') WHERE id = ${stored.id} AND user_id = ${auth.id}`))
    return { code: 200, message: result.message, data: result }
  } catch (err) {
    const message = redactSecrets(String(err.message || ''), [apiKey]).slice(0, 300)
    if (sameAsStored) (await db.run(sql`UPDATE cj_providers SET status = 'error', last_error = ${message}, tested_at = datetime('now', '+8 hours') WHERE id = ${stored.id} AND user_id = ${auth.id}`))
    if (err && typeof err === 'object') err.message = message
    throw err
  }
})
