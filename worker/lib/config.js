import { sql } from 'drizzle-orm'
import { db } from '../db.js'
import { redactSecrets } from './local-keys.js'
import { maskStoredSecret } from './secret.js'
import { readTaskConfig, TASKS } from './llm.js'

// 对外的模型配置：只含当前用户自己的服务商。密钥只返回末 4 位，本机保存的密钥服务器上没有。
export const publicConfig = async (userId, order) => {
  const rows = await db.all(sql`SELECT * FROM cj_providers WHERE user_id = ${userId} ORDER BY id`)
  const providers = []
  for (const row of rows) {
    const local = row.key_storage === 'local'
    providers.push({
      id: row.id,
      name: row.name,
      base_url: row.base_url,
      api_key: local ? '' : await maskStoredSecret(row.api_key),
      has_key: local ? false : !!row.api_key,
      key_storage: local ? 'local' : 'server',
      status: row.status,
      last_error: redactSecrets(row.last_error || ''),
      tested_at: row.tested_at
    })
  }
  if (Array.isArray(order) && order.length) {
    const rank = new Map(order.map((id, index) => [Number(id), index]))
    providers.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
  }
  return { providers, tasks: await readTaskConfig(userId), task_labels: TASKS, can_edit: true }
}
