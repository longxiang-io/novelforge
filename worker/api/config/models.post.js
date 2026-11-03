import { cjHandler, readBody, toInt } from '../../lib/common.js'
import { listProviderModels, normalizeBaseUrl, resolveCallerKey } from '../../lib/llm.js'

// POST /api/changjuan/config/models - 读取自己的服务商模型列表。密钥只在这次请求里使用。
export default cjHandler(async (event, auth) => {
  const body = await readBody(event)
  const id = toInt(body.id, 0)
  const { apiKey, stored } = (await resolveCallerKey({ userId: auth.id, providerId: id, rawKey: body.api_key }))
  const baseUrl = normalizeBaseUrl(body.base_url ?? stored?.base_url)
  const result = await listProviderModels({ baseUrl, apiKey })
  return { code: 200, data: result }
})
