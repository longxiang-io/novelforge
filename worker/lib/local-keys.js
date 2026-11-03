// 本机密钥：只活在这一次请求的内存里。不写库、不进日志、不放进用量，也不做跨请求缓存。
import { AsyncLocalStorage } from 'node:async_hooks'
import { b64ToBytes } from './crypto.js'

const storage = new AsyncLocalStorage()
const EMPTY = new Map()

// 请求头 X-Provider-Keys 的值是 base64(JSON)，形如 {"服务商id":"密钥"}。
export const readLocalKeysHeader = (value) => {
  const map = new Map()
  const raw = String(value || '')
  if (!raw || raw.length > 20000) return map
  try {
    const json = JSON.parse(new TextDecoder().decode(b64ToBytes(raw)))
    if (!json || typeof json !== 'object' || Array.isArray(json)) return map
    for (const [id, key] of Object.entries(json)) {
      const providerId = Number(id)
      const text = String(key || '')
      if (!Number.isInteger(providerId) || providerId <= 0 || !text || text.length > 4000) continue
      map.set(providerId, text)
    }
  } catch {
    return new Map()
  }
  return map
}

export const runWithLocalKeys = (map, fn) => storage.run(map instanceof Map ? map : new Map(), fn)

export const currentLocalKeys = () => storage.getStore() || EMPTY

// 错误信息和日志里不能带上密钥。extras 用来抹掉这一次解密出来、但不在请求头里的密钥。
export const redactSecrets = (text, extras = []) => {
  let out = String(text ?? '')
  const secrets = [...currentLocalKeys().values(), ...extras]
  for (const secret of secrets) {
    const token = String(secret || '')
    if (token.length < 4 || !out.includes(token)) continue
    out = out.split(token).join('〔已隐藏〕')
  }
  return out
}
