import { ElMessage, ElMessageBox } from 'element-plus'
import router from '../../router/index.js'
import { i18n } from '../../i18n.js'
import { handleAuthExpired } from '../../utils/authSession.js'
import { localKeyHeaders } from '../../utils/localProviderKeys.js'
import { createNdjsonParser } from '../../../shared/ndjson.js'

// Authenticated requests to the writing API. A 401 returns the user to the login page.
const BASE = '/api/changjuan'
const t = (key, values) => i18n.global.t(key, values)

export class CjRequestError extends Error {
  constructor(message, status, data = {}) {
    super(message)
    this.status = status
    this.data = data
  }
}

const authHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 只在真正调用模型的请求上附带本机密钥。普通读写不带这个头。
const MODEL_PATH = /(?:generate|check|extract|summary|confirm|testcases\/run|config\/models|config\/test|ai\/chats\/\d+\/messages)(?:\?|$)/

const requestHeaders = (path, { method = 'GET', body } = {}) => {
  const modelCall = method !== 'GET' && MODEL_PATH.test(String(path || ''))
  return {
    ...authHeaders(),
    ...(modelCall ? localKeyHeaders() : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
  }
}

export const settingsButtonLabel = (errorType) => {
  if (errorType === 'not_configured') return t('errors.goFillKey')
  if (errorType === 'local_key_missing') return t('errors.goFill')
  if (['quota', 'auth', 'not_found', 'bad_key', 'bad_request', 'reasoning_only'].includes(errorType)) return t('errors.goChangeModel')
  return ''
}

// 没配密钥或这台设备没有本机密钥时，给出跳转。返回 true 表示这个错误已经提示过。
export const promptModelSetup = async (err, go) => {
  const type = err?.data?.error_type
  if (type !== 'not_configured' && type !== 'local_key_missing') return false
  try {
    await ElMessageBox.confirm(err.message, type === 'local_key_missing' ? t('errors.noLocalKeyTitle') : t('errors.notConfiguredTitle'), {
      confirmButtonText: settingsButtonLabel(type),
      cancelButtonText: t('errors.gotIt')
    })
    if (typeof go === 'function') go()
  } catch {}
  return true
}

const handleError = async (res) => {
  const token = localStorage.getItem('token')
  let json = {}
  try { json = await res.json() } catch {}
  if (res.status === 401) handleAuthExpired(token, router)
  throw new CjRequestError(json.message || t('errors.http', { status: res.status }), res.status, json)
}

export const cjApi = async (path, { method = 'GET', body } = {}) => {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: requestHeaders(path, { method, body }),
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new CjRequestError(t('errors.network'), 0)
  }
  if (!res.ok) await handleError(res)
  return res.json()
}

// 读取 NDJSON 流（正文生成），每行回调一次
export const cjStream = async (path, body, onEvent, signal) => {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: requestHeaders(path, { method: 'POST', body: body || {} }),
      body: JSON.stringify(body || {}),
      signal
    })
  } catch (err) {
    if (err?.name === 'AbortError') return
    throw new CjRequestError(t('errors.network'), 0)
  }
  if (!res.ok) await handleError(res)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = createNdjsonParser((event) => {
    try { onEvent(event) } catch {}
  })
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.flush()
  } catch (err) {
    if (err?.name === 'AbortError') return
    throw new CjRequestError(t('errors.streamInterrupted'), 0)
  }
}

// 下载文件（导出 TXT / 整本书）
export const cjDownload = async (path, fallbackName) => {
  let res
  try {
    res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  } catch {
    throw new CjRequestError(t('errors.network'), 0)
  }
  if (!res.ok) await handleError(res)
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const name = match ? decodeURIComponent(match[1]) : fallbackName
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

export const toastError = (err) => ElMessage.error(err?.message || t('errors.failed'))

export const numberText = (value) => {
  const locale = i18n.global.locale.value === 'zh-CN' ? 'zh-CN' : 'en'
  return Number(value || 0).toLocaleString(locale)
}
export const pad3 = (value) => String(value).padStart(3, '0')
export const percent = (value) => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`)
export const timeText = (value) => String(value || '').slice(5, 16)

// 人物卡字段（与 server/utils/changjuan/memory.js 保持一致）
export const CHARACTER_BASE_FIELDS = [['role', '身份'], ['appearance', '外貌'], ['personality', '性格'], ['catchphrase', '口头禅'], ['arc', '成长弧线']]
export const CHARACTER_STATE_FIELDS = [['alive', '存活'], ['present', '在场'], ['realm', '境界'], ['location', '位置'], ['injury', '伤势'], ['items', '持有物品'], ['last_seen', '最后出场']]
export const KEY_STATE_FIELDS = ['alive', 'present', 'realm']
export const SETTING_CATEGORIES = ['地点', '势力', '物品', '规则', '时间线', '境界', '其他']
export const SEVERITY = {
  must: { label: '必须改', color: 'red' },
  should: { label: '建议改', color: 'amb' },
  hint: { label: '仅提示', color: 'gray' }
}
export const TASK_LABELS = { generate: '生成', check: '检查', extract: '提取改动', summary: '摘要', assist: '和 AI 聊', test: '测试集' }

const CATEGORY_CODES = {
  地点: 'place',
  势力: 'faction',
  物品: 'item',
  规则: 'rule',
  时间线: 'timeline',
  境界: 'realm',
  其他: 'other'
}

export const fieldLabel = (field) => {
  if (String(field).startsWith('relation:')) return t('fields.relation', { name: String(field).slice(9) })
  const known = [...CHARACTER_BASE_FIELDS, ...CHARACTER_STATE_FIELDS].some(([key]) => key === field)
  return known ? t(`fields.${field}`) : (field || '')
}

export const taskLabel = (task) => (task && i18n.global.te(`tasks.${task}`) ? t(`tasks.${task}`) : (TASK_LABELS[task] || task || ''))

export const severityLabel = (key) => (key && i18n.global.te(`severity.${key}`) ? t(`severity.${key}`) : (SEVERITY[key]?.label || key || ''))

export const categoryLabel = (value) => {
  const code = CATEGORY_CODES[value]
  return code ? t(`categories.${code}`) : value
}
