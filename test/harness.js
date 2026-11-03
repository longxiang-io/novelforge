import { readdir, readFile } from 'node:fs/promises'
import { Miniflare } from 'miniflare'
import { createDb, runWithDbInstance } from '../worker/db.js'
import worker from '../worker/index.js'
import { signJwt } from '../worker/auth.js'

export const JWT_SECRET = 'unit-test-jwt-secret-0123456789ab'
export const ENCRYPTION_KEY = 'unit-test-encryption-key-0123456789'

const splitSql = (text) => text
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(item => item.trim())
  .filter(Boolean)

export const startHarness = async ({ allowRegister = 'true', allowRegistration } = {}) => {
  const mf = new Miniflare({
    logRequests: false,
    workers: [{
      config: {
        name: 'app',
        compatibilityDate: '2026-10-01',
        manifest: {
          mainModule: 'index.js',
          modules: {
            'index.js': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' }
          }
        },
        env: { DB: { type: 'd1' } }
      }
    }]
  })
  const d1 = await mf.getD1Database('DB')
  const dir = new URL('../migrations/', import.meta.url)
  const names = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()
  for (const name of names) {
    const text = await readFile(new URL(name, dir), 'utf8')
    for (const statement of splitSql(text)) await d1.prepare(statement).run()
  }
  const orm = createDb(d1)
  const env = { DB: d1, JWT_SECRET, ENCRYPTION_KEY, ALLOW_REGISTRATION: allowRegistration ?? allowRegister }
  const call = async (path, { method = 'GET', token, body, headers, env: extra } = {}) => {
    const res = await worker.fetch(new Request(`http://127.0.0.1${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(headers || {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    }), { ...env, ...extra }, { waitUntil() {}, passThroughOnException() {} })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = null }
    return { status: res.status, json, text }
  }
  return {
    d1,
    orm,
    env,
    call,
    tokenFor: (id) => signJwt({ id }, JWT_SECRET),
    using: (fn) => runWithDbInstance(orm, fn),
    dispose: () => mf.dispose()
  }
}
