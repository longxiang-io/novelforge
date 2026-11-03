import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, readBody } from '../../lib/common.js'
import { encryptSecret, isMaskedInput } from '../../lib/secret.js'
import { normalizeBaseUrl, readTaskConfig, taskConfigStatement, TASKS } from '../../lib/llm.js'
import { publicConfig } from '../../lib/config.js'

const storageOf = (value) => {
  if (value === undefined || value === 'server') return 'server'
  if (value === 'local') return 'local'
  throw new CjError(400, '密钥保存方式只能是服务器或本机')
}

// PUT /api/changjuan/config - 保存当前用户自己的服务商和任务模型。
// 本机模式只记服务商和地址，api_key 留空。请求体里即使带了密钥也不会写入。
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const input = Array.isArray(body.providers) ? body.providers.slice(0, 5) : null
  if (!input) throw new CjError(400, '配置格式不正确')

  const existing = (await db.all(sql`SELECT * FROM cj_providers WHERE user_id = ${auth.id}`))
  const maxRow = (await db.get(sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM cj_providers`))
  let nextId = Number(maxRow?.max_id) || 0
  const idMap = {}
  const keep = []
  const statements = []
  for (let index = 0; index < input.length; index++) {
    const item = input[index]
    const name = String(item?.name || '').trim().slice(0, 30) || `服务商 ${String.fromCharCode(65 + index)}`
    const baseUrl = normalizeBaseUrl(item?.base_url)
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) throw new CjError(400, `「${name}」的接口地址需要以 http:// 或 https:// 开头`)
    const storage = storageOf(item?.key_storage)
    const rawKey = String(item?.api_key || '').trim()
    const current = existing.find(row => row.id === Number(item?.id))
    if (current) {
      const keyChanged = storage === 'server' && rawKey && !isMaskedInput(rawKey)
      const urlChanged = baseUrl !== current.base_url
      const switching = (storage === 'local') !== (current.key_storage === 'local')
      const status = keyChanged || urlChanged || switching ? 'unknown' : current.status
      // 切到本机，或本来就是本机，服务器上的密文都清掉。掩码不能当成新密钥。
      let apiKey = ''
      if (storage === 'server') {
        if (keyChanged) apiKey = (await encryptSecret(rawKey))
        else if (current.key_storage !== 'local') apiKey = current.api_key
      }
      statements.push(sql`
        UPDATE cj_providers
        SET name = ${name}, base_url = ${baseUrl}, api_key = ${apiKey}, key_storage = ${storage},
          status = ${status}, last_error = ${status === 'unknown' ? '' : current.last_error}
        WHERE id = ${current.id} AND user_id = ${auth.id}
      `)
      keep.push(current.id)
      idMap[item.id] = current.id
    } else {
      const id = ++nextId
      const apiKey = storage === 'server' && rawKey && !isMaskedInput(rawKey) ? (await encryptSecret(rawKey)) : ''
      statements.push(sql`
        INSERT INTO cj_providers (id, name, base_url, api_key, user_id, key_storage)
        VALUES (${id}, ${name}, ${baseUrl}, ${apiKey}, ${auth.id}, ${storage})
      `)
      keep.push(id)
      if (item?.id !== undefined) idMap[item.id] = id
      idMap[`new-${index}`] = id
    }
  }
  for (const row of existing) {
    if (!keep.includes(row.id)) statements.push(sql`DELETE FROM cj_providers WHERE id = ${row.id} AND user_id = ${auth.id}`)
  }

  if (body.tasks && typeof body.tasks === 'object') {
    const current = (await readTaskConfig(auth.id))
    const next = {}
    for (const task of Object.keys(TASKS)) {
      const item = body.tasks[task] || current[task]
      const rawId = item.provider_id
      const providerId = idMap[rawId] ?? (keep.includes(Number(rawId)) ? Number(rawId) : null)
      next[task] = {
        provider_id: providerId,
        model: String(item.model || '').trim().slice(0, 128),
        price_in: null,
        price_out: null
      }
    }
    statements.push(taskConfigStatement(auth.id, next))
  }
  ;(await db.batch(statements))
  return { code: 200, message: '已保存', data: (await publicConfig(auth.id, keep)) }
})
