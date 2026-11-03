import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, needsRehash, verifyPassword } from '../worker/lib/password.js'

test('新密码哈希是 5 万次，可以校验，错误密码不能通过', async () => {
  const stored = await hashPassword('correct-horse')
  assert.match(stored, /^pbkdf2:50000:/)
  assert.equal(needsRehash(stored), false)
  assert.equal(await verifyPassword('correct-horse', stored), true)
  assert.equal(await verifyPassword('wrong-horse', stored), false)
  assert.equal(await verifyPassword('correct-horse', 'not-a-hash'), false)
})

test('10 万次和没写次数的旧哈希仍能通过，并标记为需要重算', async () => {
  const old = await hashPassword('correct-horse', 100000)
  assert.match(old, /^pbkdf2:100000:/)
  assert.equal(await verifyPassword('correct-horse', old), true)
  assert.equal(needsRehash(old), true)

  const parts = old.split(':')
  const legacy = `pbkdf2:${parts[2]}:${parts[3]}`
  assert.equal(await verifyPassword('correct-horse', legacy), true)
  assert.equal(await verifyPassword('wrong-horse', legacy), false)
  assert.equal(needsRehash(legacy), true)

  const next = await hashPassword('correct-horse')
  assert.match(next, /^pbkdf2:50000:/)
  assert.equal(await verifyPassword('correct-horse', next), true)
})
