import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { startHarness } from './harness.js'

describe('open registration', { concurrency: false }, () => {
  let harness

  before(async () => {
    harness = await startHarness()
  })

  after(async () => {
    await harness?.dispose()
  })

  test('the schema has writing tables and no commercial tables', async () => {
    const tables = await harness.d1.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all()
    const names = new Set(tables.results.map(row => row.name))
    for (const name of ['users', 'cj_books', 'cj_chapters', 'cj_cards', 'cj_foreshadows', 'cj_versions', 'cj_providers', 'cj_ai_chats']) {
      assert.equal(names.has(name), true, name)
    }
    assert.equal(names.has('cj_invite_codes'), false)
    assert.equal(names.has('cj_announcements'), false)
    const columns = await harness.d1.prepare(`PRAGMA table_info(users)`).all()
    const userColumns = new Set(columns.results.map(row => row.name))
    assert.equal(userColumns.has('invite_code'), false)
    assert.equal(userColumns.has('member_plan'), false)
    assert.equal(userColumns.has('member_until'), false)
  })

  test('the first account is admin and the next account is a normal user', async () => {
    const first = await harness.call('/api/auth/register', {
      method: 'POST',
      body: { email: 'first@example.com', username: 'first', password: 'password1' }
    })
    assert.equal(first.status, 200, first.text)
    assert.equal(first.json.data.user.role, 'admin')
    assert.equal('member_plan' in first.json.data.user, false)

    const second = await harness.call('/api/auth/register', {
      method: 'POST',
      body: { email: 'second@example.com', username: 'second', password: 'password1' }
    })
    assert.equal(second.status, 200, second.text)
    assert.equal(second.json.data.user.role, 'user')

    const config = await harness.call('/api/auth/config')
    assert.equal(config.json.data.allow_register, true)
    assert.equal('invite_required' in config.json.data, false)
  })

  test('ALLOW_REGISTRATION false still allows the first admin, then closes sign-up', async () => {
    const closed = await startHarness({ allowRegistration: 'false' })
    try {
      const first = await closed.call('/api/auth/register', {
        method: 'POST',
        body: { email: 'root@example.com', username: 'root', password: 'password1' }
      })
      assert.equal(first.status, 200, first.text)
      assert.equal(first.json.data.user.role, 'admin')
      const next = await closed.call('/api/auth/register', {
        method: 'POST',
        body: { email: 'other@example.com', username: 'other', password: 'password1' }
      })
      assert.equal(next.status, 403, next.text)
      const config = await closed.call('/api/auth/config')
      assert.equal(config.json.data.allow_register, false)
    } finally {
      await closed.dispose()
    }
  })
})
