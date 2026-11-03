import { readStoredUser } from './authSession.js'

// 按用户分开存。同一台浏览器换账号时，不会把别人的密钥发出去。
const STORAGE_KEY = 'cj.localProviderKeys'

const readAll = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

const writeAll = (value) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export const readLocalKey = (userId, providerId) => {
  const mine = readAll()[String(userId)]
  if (!mine || typeof mine !== 'object') return ''
  const key = mine[String(providerId)]
  return typeof key === 'string' ? key : ''
}

export const writeLocalKey = (userId, providerId, key) => {
  const all = readAll()
  const mine = { ...(all[String(userId)] && typeof all[String(userId)] === 'object' ? all[String(userId)] : {}) }
  const text = String(key || '')
  if (!text) delete mine[String(providerId)]
  else mine[String(providerId)] = text
  if (Object.keys(mine).length) all[String(userId)] = mine
  else delete all[String(userId)]
  writeAll(all)
}

export const removeLocalKey = (userId, providerId) => writeLocalKey(userId, providerId, '')

export const maskKey = (key) => {
  const text = String(key || '')
  if (!text) return ''
  return `••••••••${text.slice(-4)}`
}

// 调用模型时附在请求头上。服务器只在这一次请求里使用，不会保存。
export const localKeyHeaders = () => {
  const userId = readStoredUser()?.id
  if (!userId) return {}
  const mine = readAll()[String(userId)]
  if (!mine || typeof mine !== 'object') return {}
  const payload = {}
  for (const [id, key] of Object.entries(mine)) {
    if (typeof key === 'string' && key) payload[id] = key
  }
  if (!Object.keys(payload).length) return {}
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return { 'X-Provider-Keys': btoa(binary) }
}
