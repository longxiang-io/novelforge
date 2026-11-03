import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from './db.js'
import { getEnv } from './env.js'
import { hashPassword, needsRehash, verifyPassword } from './lib/password.js'
import { registrationOpen } from './lib/register-policy.js'
import { formatWait, getRateLimitWait, hitRateLimit, resetRateLimit } from './lib/rate-limit.js'
import { avatarKey } from '../shared/avatars.js'

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14
const LOGIN_WINDOW_MS = 5 * 60 * 1000
const LOGIN_ACCOUNT_LIMIT = 10
const LOGIN_IP_LIMIT = 30
const encoder = new TextEncoder()
const USERNAME_RE = /^[\p{L}\p{N}_-]{2,32}$/u
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 令牌里只放密码哈希的摘要。改密码后摘要对不上，其他会话就失效。
export const sessionStamp = async (passwordHash) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(passwordHash || '')))
  return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const clientIp = (c) => {
  const forwarded = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
  return String(forwarded).split(',')[0].trim() || 'unknown'
}

const accountKey = (value) => String(value || '').trim().toLowerCase()

const loginWait = (ip, account) => Math.max(
  getRateLimitWait(`login:${ip}:${accountKey(account)}`, LOGIN_ACCOUNT_LIMIT),
  getRateLimitWait(`login-ip:${ip}`, LOGIN_IP_LIMIT)
)

const hitLogin = (ip, accounts) => {
  for (const account of accounts) hitRateLimit(`login:${ip}:${accountKey(account)}`, LOGIN_WINDOW_MS)
  hitRateLimit(`login-ip:${ip}`, LOGIN_WINDOW_MS)
}

const clearLogin = (ip, accounts) => {
  for (const account of accounts) resetRateLimit(`login:${ip}:${accountKey(account)}`)
}

const bytesToB64Url = (bytes) => {
  let binary = ''
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const b64UrlToBytes = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

const hmacKey = (secret) => crypto.subtle.importKey(
  'raw',
  encoder.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
)

export const signJwt = async (payload, secret) => {
  const header = bytesToB64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const now = Math.floor(Date.now() / 1000)
  const body = bytesToB64Url(encoder.encode(JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS })))
  const data = `${header}.${body}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data))
  return `${data}.${bytesToB64Url(sig)}`
}

export const verifyJwt = async (token, secret) => {
  const parts = String(token || '').split('.')
  if (parts.length !== 3 || !secret) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64UrlToBytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(parts[1])))
    if (!payload?.id || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

const jsonError = (c, status, message) => c.json({ code: status, message }, status)

const requireSecret = (c) => {
  const secret = c.env.JWT_SECRET || getEnv().JWT_SECRET
  if (!secret || String(secret).length < 16) return null
  return String(secret)
}

const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  username: row.username,
  role: row.role,
  name: row.username,
  avatar: avatarKey(row?.avatar),
  username_changed: !!row?.username_changed_at
})

const USER_FIELDS = sql`id, email, username, role, status, password_hash, avatar, username_changed_at`

const readAccountBody = async (c) => {
  try {
    const body = await c.req.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

export const requireUser = async (c, next) => {
  const secret = requireSecret(c)
  if (!secret) return jsonError(c, 500, 'JWT_SECRET 未配置或太短')
  const header = c.req.header('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return jsonError(c, 401, '未登录或登录已过期')
  const payload = await verifyJwt(token, secret)
  if (!payload) return jsonError(c, 401, '登录令牌无效或已过期')
  const user = await db.get(sql`SELECT ${USER_FIELDS} FROM users WHERE id = ${payload.id}`)
  if (!user) return jsonError(c, 401, '登录用户不存在，请重新登录')
  if (user.status !== 'active') return jsonError(c, 401, '账号已被禁用')
  if (payload.sv && payload.sv !== await sessionStamp(user.password_hash)) {
    return jsonError(c, 401, '登录已失效，请重新登录')
  }
  c.set('user', publicUser(user))
  await next()
}

const issueSession = async (c, user, message = 'ok') => {
  const secret = requireSecret(c)
  if (!secret) return jsonError(c, 500, 'JWT_SECRET 未配置或太短')
  const sv = user.password_hash ? await sessionStamp(user.password_hash) : ''
  const token = await signJwt({ id: user.id, ...(sv ? { sv } : {}) }, secret)
  return c.json({ code: 200, message, data: { token, user: publicUser(user) } })
}

export const authRoutes = new Hono()

authRoutes.get('/config', async (c) => {
  const countRow = await db.get(sql`SELECT COUNT(*) AS count FROM users`)
  const count = Number(countRow?.count || 0)
  const env = c.env || getEnv()
  const open = registrationOpen(env, count)
  return c.json({ code: 200, data: { allow_register: open } })
})

const errorText = (err) => {
  const parts = []
  const seen = new Set()
  let current = err
  while (current && !seen.has(current) && parts.length < 6) {
    seen.add(current)
    parts.push(typeof current === 'string' ? current : String(current.message || current))
    current = current.cause
  }
  return parts.join('\n')
}

const uniqueMessage = (err) => {
  const message = errorText(err)
  if (/users\.email|idx_users_email/i.test(message)) return '这个邮箱已经注册过了'
  if (/users\.username|idx_users_username/i.test(message)) return '这个用户名已经被占用了'
  return ''
}

authRoutes.post('/register', async (c) => {
  const body = await readAccountBody(c)
  const email = String(body.email || '').trim().toLowerCase()
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  if (!EMAIL_RE.test(email) || email.length > 120) return jsonError(c, 400, '请填写有效邮箱')
  if (!USERNAME_RE.test(username)) return jsonError(c, 400, '用户名需要 2 到 32 位，可用中文、字母、数字、下划线和短横线')
  if (password.length < 8 || password.length > 200) return jsonError(c, 400, '密码至少 8 位')
  const env = c.env || getEnv()
  const countRow = await db.get(sql`SELECT COUNT(*) AS count FROM users`)
  const count = Number(countRow?.count || 0)
  if (!registrationOpen(env, count)) return jsonError(c, 403, '注册已关闭')
  const existingEmail = await db.get(sql`SELECT id FROM users WHERE email = ${email}`)
  if (existingEmail) return jsonError(c, 409, '这个邮箱已经注册过了')
  const existingName = await db.get(sql`SELECT id FROM users WHERE username = ${username}`)
  if (existingName) return jsonError(c, 409, '这个用户名已经被占用了')
  const passwordHash = await hashPassword(password)
  let user
  try {
    // Count and insert are one statement, so the first committed account is the admin.
    const result = await db.run(sql`
      INSERT INTO users (email, username, password_hash, role)
      SELECT ${email}, ${username}, ${passwordHash},
        CASE WHEN (SELECT COUNT(*) FROM users) = 0 THEN 'admin' ELSE 'user' END
    `)
    user = await db.get(sql`SELECT ${USER_FIELDS} FROM users WHERE id = ${Number(result.lastInsertRowid)}`)
  } catch (err) {
    const message = uniqueMessage(err)
    if (message) return jsonError(c, 409, message)
    throw err
  }
  return issueSession(c, user)
})

authRoutes.post('/login', async (c) => {
  const body = await readAccountBody(c)
  const account = String(body.account || body.email || body.username || '').trim()
  const password = String(body.password || '')
  if (!account || !password) return jsonError(c, 400, '请填写账号和密码')
  const ip = clientIp(c)
  const wait = loginWait(ip, account)
  if (wait) return jsonError(c, 429, `登录失败次数过多，请 ${formatWait(wait)}后再试`)
  const normalized = account.includes('@') ? account.toLowerCase() : account
  const byEmail = await db.get(sql`SELECT * FROM users WHERE email = ${normalized}`)
  const user = byEmail || await db.get(sql`SELECT * FROM users WHERE username = ${account}`)
  if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
    hitLogin(ip, [account])
    return jsonError(c, 401, '账号或密码不正确')
  }
  // 旧哈希次数更高时，登录成功后换成当前默认次数，下次就不用再跑那么多轮。
  if (needsRehash(user.password_hash)) {
    try {
      const nextHash = await hashPassword(password)
      await db.run(sql`UPDATE users SET password_hash = ${nextHash} WHERE id = ${user.id}`)
      user.password_hash = nextHash
    } catch (err) {
      console.error('[NovelForge] password rehash failed:', err)
    }
  }
  try {
    await db.run(sql`UPDATE users SET last_login_at = datetime('now', '+8 hours') WHERE id = ${user.id}`)
  } catch (err) {
    console.error('[NovelForge] failed to record last login:', err)
  }
  clearLogin(ip, [account])
  return issueSession(c, user)
})

authRoutes.get('/me', requireUser, (c) => c.json({ code: 200, data: { user: c.get('user') } }))

const loadAccount = (id) => db.get(sql`SELECT ${USER_FIELDS} FROM users WHERE id = ${id}`)

// 当前密码猜错和登录失败记在同一组限流里。
const guardPasswordGuess = async (c, user) => {
  const ip = clientIp(c)
  const accounts = [...new Set([user.username, user.email].map(accountKey).filter(Boolean))]
  const wait = accounts.reduce((max, account) => Math.max(max, loginWait(ip, account)), 0)
  if (wait) return { error: jsonError(c, 429, `登录失败次数过多，请 ${formatWait(wait)}后再试`) }
  return {
    ip,
    accounts,
    fail() { hitLogin(ip, accounts) },
    clear() { clearLogin(ip, accounts) }
  }
}

authRoutes.post('/password', requireUser, async (c) => {
  const body = await readAccountBody(c)
  const current = String(body.current_password || '')
  const next = String(body.new_password || '')
  const confirm = String(body.confirm_password ?? '')
  if (!current || !next) return jsonError(c, 400, '请填写当前密码和新密码')
  if (next.length < 8 || next.length > 200) return jsonError(c, 400, '密码至少 8 位')
  if (next !== confirm) return jsonError(c, 400, '两次输入的新密码不一致')
  const user = await loadAccount(c.get('user').id)
  if (!user || user.status !== 'active') return jsonError(c, 401, '登录已失效，请重新登录')
  const guard = await guardPasswordGuess(c, user)
  if (guard.error) return guard.error
  if (!(await verifyPassword(current, user.password_hash))) {
    guard.fail()
    return jsonError(c, 401, '当前密码不正确')
  }
  guard.clear()
  if (next === current) return jsonError(c, 400, '新密码不能和当前密码相同')
  const passwordHash = await hashPassword(next)
  await db.run(sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${user.id}`)
  user.password_hash = passwordHash
  return issueSession(c, user, '密码已更新')
})

authRoutes.put('/avatar', requireUser, async (c) => {
  const body = await readAccountBody(c)
  if (!Object.prototype.hasOwnProperty.call(body, 'avatar')) return jsonError(c, 400, '请选择预设头像')
  if (body.avatar !== null && body.avatar !== '' && !avatarKey(body.avatar)) return jsonError(c, 400, '请选择预设头像')
  const avatar = avatarKey(body.avatar)
  const id = c.get('user').id
  await db.run(sql`UPDATE users SET avatar = ${avatar} WHERE id = ${id}`)
  const user = await loadAccount(id)
  return c.json({ code: 200, message: '头像已更新', data: { user: publicUser(user) } })
})

authRoutes.post('/username', requireUser, async (c) => {
  const body = await readAccountBody(c)
  const username = String(body.username || '').trim()
  if (!USERNAME_RE.test(username)) return jsonError(c, 400, '用户名需要 2 到 32 位，可用中文、字母、数字、下划线和短横线')
  const current = await loadAccount(c.get('user').id)
  if (!current || current.status !== 'active') return jsonError(c, 401, '登录已失效，请重新登录')
  if (current.username_changed_at) return jsonError(c, 400, '用户名只能修改一次')
  const taken = await db.get(sql`SELECT id FROM users WHERE username = ${username}`)
  if (taken && Number(taken.id) === Number(current.id)) return jsonError(c, 400, '新用户名和现在一样')
  if (taken) return jsonError(c, 409, '这个用户名已经被占用了')
  try {
    const result = await db.run(sql`
      UPDATE users
      SET username = ${username}, username_changed_at = datetime('now', '+8 hours')
      WHERE id = ${current.id} AND username_changed_at IS NULL
    `)
    if (!result.changes) return jsonError(c, 400, '用户名只能修改一次')
  } catch (err) {
    const message = uniqueMessage(err)
    if (message) return jsonError(c, 409, message)
    throw err
  }
  const user = await loadAccount(current.id)
  return c.json({ code: 200, message: '用户名已更新', data: { user: publicUser(user) } })
})
