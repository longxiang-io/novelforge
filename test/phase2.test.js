import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { db } from '../worker/db.js'
import { hashPassword } from '../worker/lib/password.js'
import { startHarness } from './harness.js'

let harness
let adminToken
let bobToken

const encodeKeys = (payload) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const headerOf = (init) => {
  const headers = init?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') return headers.get('authorization') || ''
  return headers.Authorization || headers.authorization || ''
}

const withFetch = async (handler, fn) => {
  const real = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const href = String(url)
    if (!href.includes('example.test')) return real(url, init)
    return handler(href, init)
  }
  try {
    return await fn()
  } finally {
    globalThis.fetch = real
  }
}

const call = (path, options = {}) => harness.call(path, options)

const wipe = async () => {
  await harness.d1.exec(`
    DELETE FROM cj_providers;
    DELETE FROM cj_settings;
    DELETE FROM cj_usage;
  `)
}

const row = (query) => harness.using(() => db.get(query))

before(async () => {
  harness = await startHarness()
  const passwordHash = await hashPassword('password1')
  await harness.using(async () => {
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (1, 'admin@xs.local', 'admin', ${passwordHash}, 'admin', 'active')`)
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (2, 'bob@xs.local', 'bob', ${passwordHash}, 'user', 'active')`)
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (3, 'cara@xs.local', 'cara', ${passwordHash}, 'user', 'active')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (1, 1, '管理员的书')`)
    await db.run(sql`INSERT INTO cj_volumes (id, user_id, book_id, sort, title) VALUES (1, 1, 1, 1, '卷一')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, content, status) VALUES (1, 1, 1, 1, 1, '开篇', '', 'draft')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title, world, outline) VALUES (2, 2, '鲍勃的书', '世界观机密XYZ', '大纲机密XYZ')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, number, title, content, summary, status) VALUES (2, 2, 2, 1, '第一章', '机密正文不要出现', '摘要机密XYZ', 'draft')`)
    await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name, data) VALUES (1, 2, 2, 'character', '卡片机密XYZ', '卡片内容机密XYZ')`)
  })
  adminToken = await harness.tokenFor(1)
  bobToken = await harness.tokenFor(2)
})

after(async () => {
  await harness?.dispose()
})

describe('每人的模型密钥', { concurrency: false }, () => {
  test('用户 A 的服务商，用户 B 读不到也改不了', async () => {
    await wipe()
    const secret = 'sk-alice-secret-9999'
    const saved = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: {
        providers: [{ name: '爱丽丝的服务商', base_url: 'https://example.test/v1', api_key: secret, key_storage: 'server' }],
        tasks: { generate: { provider_id: null, model: '', price_in: null, price_out: null } }
      }
    })
    assert.equal(saved.status, 200, saved.text)
    const mine = saved.json.data.providers[0]
    assert.equal(saved.json.data.can_edit, true)
    assert.equal(mine.has_key, true)
    assert.equal(mine.api_key.endsWith('9999'), true)
    assert.equal(saved.text.includes(secret), false)
    assert.equal(saved.text.includes('enc:v1:'), false)
    const stored = await row(sql`SELECT api_key, user_id FROM cj_providers WHERE id = ${mine.id}`)
    assert.equal(stored.user_id, 1)
    assert.equal(stored.api_key.startsWith('enc:v1:'), true)
    assert.notEqual(stored.api_key, secret)

    const bobView = await call('/api/changjuan/config', { token: bobToken })
    assert.equal(bobView.status, 200)
    assert.equal(bobView.text.includes('爱丽丝的服务商'), false)
    assert.equal(bobView.text.includes(secret), false)
    assert.equal(bobView.json.data.providers.length, 0)

    await withFetch(() => { throw new Error('不应请求上游') }, async () => {
      const tested = await call('/api/changjuan/config/test', { method: 'POST', token: bobToken, body: { id: mine.id, base_url: 'https://example.test/v1' } })
      assert.equal(tested.status, 404, tested.text)
      const models = await call('/api/changjuan/config/models', { method: 'POST', token: bobToken, body: { id: mine.id, base_url: 'https://example.test/v1' } })
      assert.equal(models.status, 404, models.text)
    })

    const stolen = await call('/api/changjuan/config', {
      method: 'PUT',
      token: bobToken,
      body: {
        providers: [{ id: mine.id, name: '偷来的', base_url: 'https://example.test/v1', api_key: 'sk-bob', key_storage: 'server' }]
      }
    })
    assert.equal(stolen.status, 200, stolen.text)
    const still = await row(sql`SELECT name, api_key, user_id FROM cj_providers WHERE id = ${mine.id}`)
    assert.equal(still.name, '爱丽丝的服务商')
    assert.equal(still.user_id, 1)
    assert.equal(still.api_key, stored.api_key)
    assert.equal(stolen.json.data.providers.some(item => item.id === mine.id), false)

    const generate = await call('/api/changjuan/chapters/2/generate', { method: 'POST', token: bobToken, body: {} })
    assert.equal(generate.status, 400, generate.text)
    assert.equal(generate.json.error_type, 'not_configured')
    assert.equal(generate.text.includes(secret), false)
  })

  test('本机模式不把密钥写入服务器，切换时清掉旧密文', async () => {
    await wipe()
    const secret = 'sk-server-key-1357'
    const server = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: { providers: [{ name: '服务器', base_url: 'https://example.test/v1', api_key: secret, key_storage: 'server' }] }
    })
    assert.equal(server.status, 200, server.text)
    const id = server.json.data.providers[0].id
    const cipher = await row(sql`SELECT api_key FROM cj_providers WHERE id = ${id}`)
    assert.equal(cipher.api_key.startsWith('enc:v1:'), true)
    assert.notEqual(cipher.api_key, secret)
    const listed = await call('/api/changjuan/config', { token: adminToken })
    assert.equal(listed.json.data.providers[0].api_key.endsWith('1357'), true)
    assert.equal(listed.text.includes(secret), false)

    const local = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: { providers: [{ id, name: '本机', base_url: 'https://example.test/v1', api_key: secret, key_storage: 'local' }] }
    })
    assert.equal(local.status, 200, local.text)
    assert.equal(local.text.includes(secret), false)
    assert.equal(local.json.data.providers[0].key_storage, 'local')
    assert.equal(local.json.data.providers[0].has_key, false)
    assert.equal(local.json.data.providers[0].api_key, '')
    const cleared = await row(sql`SELECT api_key, key_storage FROM cj_providers WHERE id = ${id}`)
    assert.equal(cleared.api_key, '')
    assert.equal(cleared.key_storage, 'local')

    const back = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: { providers: [{ id, name: '服务器', base_url: 'https://example.test/v1', api_key: secret, key_storage: 'server' }] }
    })
    assert.equal(back.status, 200, back.text)
    const again = await row(sql`SELECT api_key, key_storage FROM cj_providers WHERE id = ${id}`)
    assert.equal(again.key_storage, 'server')
    assert.equal(again.api_key.startsWith('enc:v1:'), true)
    assert.notEqual(again.api_key, secret)
    assert.equal(back.text.includes(secret), false)
  })

  test('请求头里的本机密钥只用于这一次调用，错误信息会脱敏', async () => {
    await wipe()
    const secret = 'sk-local-only-4242'
    const saved = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: { providers: [{ name: '本机', base_url: 'https://example.test/v1', api_key: secret, key_storage: 'local' }] }
    })
    const id = saved.json.data.providers[0].id
    const headers = { 'x-provider-keys': encodeKeys({ [id]: secret }) }
    let seen = ''
    const failed = await withFetch(async (_url, init) => {
      seen = headerOf(init)
      return new Response(JSON.stringify({ error: { message: `rejected ${secret}` } }), { status: 401 })
    }, () => call('/api/changjuan/config/test', {
      method: 'POST',
      token: adminToken,
      headers,
      body: { id, base_url: 'https://example.test/v1' }
    }))
    assert.equal(seen, `Bearer ${secret}`)
    assert.equal(failed.status, 502, failed.text)
    assert.equal(failed.text.includes(secret), false)
    assert.equal(failed.text.includes('〔已隐藏〕'), true)
    const after = await row(sql`SELECT api_key, last_error, key_storage FROM cj_providers WHERE id = ${id}`)
    assert.equal(after.api_key, '')
    assert.equal(after.key_storage, 'local')
    assert.equal(String(after.last_error).includes(secret), false)

    let called = 0
    const missing = await withFetch(async () => {
      called += 1
      return new Response('no', { status: 500 })
    }, () => call('/api/changjuan/config/test', {
      method: 'POST',
      token: adminToken,
      body: { id, base_url: 'https://example.test/v1' }
    }))
    assert.equal(called, 0)
    assert.equal(missing.status, 400, missing.text)
    assert.equal(missing.json.error_type, 'local_key_missing')
    assert.equal(missing.json.message, '这台设备没有保存密钥，请在设置页填写')
  })

  test('生成时用这次请求头里的密钥，下次不带就失败，用量里没有密钥', async () => {
    await wipe()
    const secret = 'sk-generate-local-8888'
    const saved = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: {
        providers: [{ name: '本机生成', base_url: 'https://example.test/v1', api_key: '', key_storage: 'local' }],
        tasks: {}
      }
    })
    const id = saved.json.data.providers[0].id
    const tasked = await call('/api/changjuan/config', {
      method: 'PUT',
      token: adminToken,
      body: {
        providers: [{ id, name: '本机生成', base_url: 'https://example.test/v1', api_key: '', key_storage: 'local' }],
        tasks: { generate: { provider_id: id, model: 'demo-model', price_in: 1, price_out: 1 } }
      }
    })
    assert.equal(tasked.status, 200, tasked.text)
    const headers = { 'x-provider-keys': encodeKeys({ [id]: secret }) }
    const sse = [
      'data: {"choices":[{"delta":{"content":"你好"}}]}',
      '',
      'data: {"usage":{"prompt_tokens":4,"completion_tokens":2}}',
      '',
      'data: [DONE]',
      ''
    ].join('\n')
    let calls = 0
    const generated = await withFetch(async (_url, init) => {
      calls += 1
      assert.equal(headerOf(init), `Bearer ${secret}`)
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }, () => call('/api/changjuan/chapters/1/generate', { method: 'POST', token: adminToken, headers, body: { mode: 'full' } }))
    assert.equal(generated.status, 200, generated.text)
    assert.equal(generated.text.includes('你好'), true)
    assert.equal(generated.text.includes(secret), false)
    assert.equal(calls, 1)
    const usage = await row(sql`SELECT output_chars, model, task FROM cj_usage WHERE user_id = 1 ORDER BY id DESC`)
    assert.equal(usage.task, 'generate')
    assert.equal(usage.model, 'demo-model')
    assert.equal(usage.output_chars, 2)
    const dumped = await harness.d1.prepare('SELECT * FROM cj_usage').all()
    assert.equal(JSON.stringify(dumped).includes(secret), false)
    const chapter = await row(sql`SELECT content FROM cj_chapters WHERE id = 1`)
    assert.equal(String(chapter.content).includes(secret), false)

    calls = 0
    const again = await withFetch(async () => {
      calls += 1
      return new Response(sse, { status: 200 })
    }, () => call('/api/changjuan/chapters/1/generate', { method: 'POST', token: adminToken, body: { mode: 'full' } }))
    assert.equal(again.status, 400, again.text)
    assert.equal(again.json.error_type, 'local_key_missing')
    assert.equal(calls, 0)
    assert.equal(again.text.includes(secret), false)
  })

  test('登录写入最后登录时间，没登录过的用户是空的', async () => {
    const login = await call('/api/auth/login', { method: 'POST', body: { account: 'bob', password: 'password1' } })
    assert.equal(login.status, 200, login.text)
    const bob = await row(sql`SELECT date(last_login_at) AS day, date('now', '+8 hours') AS today FROM users WHERE id = 2`)
    assert.equal(bob.day, bob.today)
    const cara = await row(sql`SELECT last_login_at FROM users WHERE id = 3`)
    assert.equal(cara.last_login_at, null)
  })
})
