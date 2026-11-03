import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { db } from '../worker/db.js'
import { hashPassword, verifyPassword } from '../worker/lib/password.js'
import { AVATARS } from '../shared/avatars.js'
import { startHarness } from './harness.js'

let harness

const call = (path, { ip = '198.51.100.20', ...options } = {}) => harness.call(path, {
  ...options,
  headers: { 'cf-connecting-ip': ip, ...(options.headers || {}) }
})

const payloadOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())

const createUser = async ({ id, email, username, password = 'password1', role = 'user', ip }) => {
  const passwordHash = await hashPassword(password)
  await harness.using(() => db.run(sql`
    INSERT INTO users (id, email, username, password_hash, role)
    VALUES (${id}, ${email}, ${username}, ${passwordHash}, ${role})
  `))
  const login = await call('/api/auth/login', {
    method: 'POST',
    ip,
    body: { account: username, password }
  })
  assert.equal(login.status, 200, login.text)
  return { token: login.json.data.token, user: login.json.data.user }
}

before(async () => {
  harness = await startHarness()
})

after(async () => {
  await harness.dispose()
})

describe('个人资料', { concurrency: false }, () => {
  test('users 增加可空的头像和用户名修改时间', async () => {
    const cols = await harness.d1.prepare('PRAGMA table_info(users)').all()
    const byName = new Map(cols.results.map(col => [col.name, col]))
    assert.equal(byName.get('avatar').notnull, 0)
    assert.equal(byName.get('username_changed_at').notnull, 0)
    assert.equal(AVATARS.length, 12)
  })

  test('当前密码错误会被拒绝，改完后旧密码不能登录，其他会话失效', async () => {
    const ip = '198.51.100.31'
    const created = await createUser({ id: 31, email: 'pw@xs.local', username: 'pwuser', ip })
    assert.ok(payloadOf(created.token).sv)
    const other = await call('/api/auth/login', {
      method: 'POST',
      ip,
      body: { account: 'pwuser', password: 'password1' }
    })
    assert.equal(other.status, 200, other.text)
    const oldStamp = payloadOf(other.json.data.token).sv

    const wrong = await call('/api/auth/password', {
      method: 'POST',
      ip,
      token: created.token,
      body: { current_password: 'not-the-password', new_password: 'password2', confirm_password: 'password2' }
    })
    assert.equal(wrong.status, 401)
    assert.equal(wrong.json.message, '当前密码不正确')
    assert.equal(wrong.text.includes('not-the-password'), false)
    assert.equal(wrong.text.includes('password_hash'), false)

    const short = await call('/api/auth/password', {
      method: 'POST',
      ip,
      token: created.token,
      body: { current_password: 'password1', new_password: 'short', confirm_password: 'short' }
    })
    assert.equal(short.status, 400)
    assert.match(short.json.message, /至少 8 位/)

    const mismatch = await call('/api/auth/password', {
      method: 'POST',
      ip,
      token: created.token,
      body: { current_password: 'password1', new_password: 'password2', confirm_password: 'password3' }
    })
    assert.equal(mismatch.status, 400)
    assert.match(mismatch.json.message, /不一致/)

    const same = await call('/api/auth/password', {
      method: 'POST',
      ip,
      token: created.token,
      body: { current_password: 'password1', new_password: 'password1', confirm_password: 'password1' }
    })
    assert.equal(same.status, 400)
    assert.equal(same.json.message, '新密码不能和当前密码相同')

    const changed = await call('/api/auth/password', {
      method: 'POST',
      ip,
      token: created.token,
      body: { current_password: 'password1', new_password: 'password2', confirm_password: 'password2' }
    })
    assert.equal(changed.status, 200, changed.text)
    assert.equal(changed.json.message, '密码已更新')
    assert.equal(changed.text.includes('password2'), false)
    assert.equal(changed.text.includes('password1'), false)
    assert.equal(changed.text.includes('password_hash'), false)
    assert.equal(changed.text.includes('pbkdf2'), false)
    const nextToken = changed.json.data.token
    assert.notEqual(payloadOf(nextToken).sv, oldStamp)

    const stale = await call('/api/auth/me', { token: other.json.data.token, ip })
    assert.equal(stale.status, 401)
    assert.match(stale.json.message, /失效/)
    const kept = await call('/api/auth/me', { token: nextToken, ip })
    assert.equal(kept.status, 200, kept.text)
    assert.equal(kept.json.data.user.username, 'pwuser')

    // 这次上线前签发的令牌没有会话摘要，改密码不会把它作废。
    const legacy = await call('/api/auth/me', { token: await harness.tokenFor(created.user.id), ip })
    assert.equal(legacy.status, 200, legacy.text)

    const oldLogin = await call('/api/auth/login', {
      method: 'POST',
      ip,
      body: { account: 'pwuser', password: 'password1' }
    })
    assert.equal(oldLogin.status, 401)
    const nextLogin = await call('/api/auth/login', {
      method: 'POST',
      ip,
      body: { account: 'pwuser', password: 'password2' }
    })
    assert.equal(nextLogin.status, 200, nextLogin.text)
    const stored = await harness.using(() => db.get(sql`SELECT password_hash FROM users WHERE id = 31`))
    assert.equal(await verifyPassword('password2', stored.password_hash), true)
    assert.equal(await verifyPassword('password1', stored.password_hash), false)
  })

  test('改密码猜错和登录失败共用限流，格式错误不计数', async () => {
    const ip = '198.51.100.32'
    const created = await createUser({ id: 32, email: 'limit@xs.local', username: 'limituser', ip })
    for (let i = 0; i < 10; i++) {
      const skipped = await call('/api/auth/password', {
        method: 'POST',
        ip,
        token: created.token,
        body: { current_password: 'password1', new_password: 'abc', confirm_password: 'abc' }
      })
      assert.equal(skipped.status, 400)
    }
    for (let i = 0; i < 9; i++) {
      const wrong = await call('/api/auth/password', {
        method: 'POST',
        ip,
        token: created.token,
        body: { current_password: 'wrong-password', new_password: 'password9', confirm_password: 'password9' }
      })
      assert.equal(wrong.status, 401, wrong.text)
    }
    const loginFail = await call('/api/auth/login', {
      method: 'POST',
      ip,
      body: { account: 'limituser', password: 'still-wrong' }
    })
    assert.equal(loginFail.status, 401, loginFail.text)
    const blocked = await call('/api/auth/password', {
      method: 'POST',
      ip,
      token: created.token,
      body: { current_password: 'password1', new_password: 'password9', confirm_password: 'password9' }
    })
    assert.equal(blocked.status, 429, blocked.text)
    assert.match(blocked.json.message, /登录失败次数过多/)
    assert.equal(blocked.text.includes('password1'), false)
  })

  test('头像只接受预设，登录和当前用户都会返回', async () => {
    const ip = '198.51.100.33'
    const created = await createUser({ id: 33, email: 'ava@xs.local', username: 'avauser', role: 'admin', ip })
    assert.equal(created.user.avatar, null)
    const token = created.token

    const missing = await call('/api/auth/avatar', { method: 'PUT', ip, token, body: {} })
    assert.equal(missing.status, 400)
    const bad = await call('/api/auth/avatar', { method: 'PUT', ip, token, body: { avatar: 'https://evil.test/a.png' } })
    assert.equal(bad.status, 400)
    assert.equal(bad.json.message, '请选择预设头像')

    const picked = await call('/api/auth/avatar', { method: 'PUT', ip, token, body: { avatar: 'fox' } })
    assert.equal(picked.status, 200, picked.text)
    assert.equal(picked.json.data.user.avatar, 'fox')
    assert.equal(picked.json.data.token, undefined)
    const me = await call('/api/auth/me', { ip, token })
    assert.equal(me.json.data.user.avatar, 'fox')
    const login = await call('/api/auth/login', {
      method: 'POST',
      ip,
      body: { account: 'avauser', password: 'password1' }
    })
    assert.equal(login.status, 200, login.text)
    assert.equal(login.json.data.user.avatar, 'fox')

    const cleared = await call('/api/auth/avatar', { method: 'PUT', ip, token, body: { avatar: null } })
    assert.equal(cleared.status, 200, cleared.text)
    assert.equal(cleared.json.data.user.avatar, null)
    const stored = await harness.using(() => db.get(sql`SELECT avatar FROM users WHERE id = 33`))
    assert.equal(stored.avatar, null)

    await call('/api/auth/avatar', { method: 'PUT', ip, token, body: { avatar: 'cat' } })
    const again = await call('/api/auth/me', { ip, token })
    assert.equal(again.status, 200, again.text)
    assert.equal(again.json.data.user.avatar, 'cat')
    assert.equal(again.text.includes('password_hash'), false)
    assert.equal(again.text.includes('password1'), false)
  })

  test('用户名只能改一次，重名被拒，改完用新名字登录', async () => {
    const ip = '198.51.100.34'
    const alice = await createUser({ id: 41, email: 'alice@xs.local', username: 'alice', ip })
    const bob = await createUser({ id: 42, email: 'bob@xs.local', username: 'bob', ip })
    const cara = await createUser({ id: 43, email: 'cara@xs.local', username: 'cara', ip })
    assert.equal(alice.user.username_changed, false)

    const invalid = await call('/api/auth/username', { method: 'POST', ip, token: alice.token, body: { username: 'a' } })
    assert.equal(invalid.status, 400)
    const same = await call('/api/auth/username', { method: 'POST', ip, token: alice.token, body: { username: 'Alice' } })
    assert.equal(same.status, 400)
    assert.equal(same.json.message, '新用户名和现在一样')
    const taken = await call('/api/auth/username', { method: 'POST', ip, token: alice.token, body: { username: 'Bob' } })
    assert.equal(taken.status, 409)
    assert.equal(taken.json.message, '这个用户名已经被占用了')
    const still = await call('/api/auth/me', { ip, token: alice.token })
    assert.equal(still.json.data.user.username_changed, false)

    const [left, right] = await Promise.all([
      call('/api/auth/username', { method: 'POST', ip, token: alice.token, body: { username: 'aliceone' } }),
      call('/api/auth/username', { method: 'POST', ip, token: alice.token, body: { username: 'alicetwo' } })
    ])
    const ok = [left, right].filter(item => item.status === 200)
    const denied = [left, right].filter(item => item.status === 400)
    assert.equal(ok.length, 1, JSON.stringify([left, right].map(item => [item.status, item.json?.message])))
    assert.equal(denied.length, 1)
    assert.equal(denied[0].json.message, '用户名只能修改一次')
    const winner = ok[0].json.data.user.username
    assert.equal(ok[0].json.data.token, undefined)
    assert.equal(ok[0].json.data.user.username_changed, true)
    const me = await call('/api/auth/me', { ip, token: alice.token })
    assert.equal(me.status, 200, me.text)
    assert.equal(me.json.data.user.username, winner)

    const again = await call('/api/auth/username', { method: 'POST', ip, token: alice.token, body: { username: 'alicethree' } })
    assert.equal(again.status, 400)
    assert.equal(again.json.message, '用户名只能修改一次')

    const oldLogin = await call('/api/auth/login', { method: 'POST', ip, body: { account: 'alice', password: 'password1' } })
    assert.equal(oldLogin.status, 401)
    const nextLogin = await call('/api/auth/login', { method: 'POST', ip, body: { account: winner, password: 'password1' } })
    assert.equal(nextLogin.status, 200, nextLogin.text)
    assert.equal(nextLogin.json.data.user.username, winner)

    const [sharedBob, sharedCara] = await Promise.all([
      call('/api/auth/username', { method: 'POST', ip, token: bob.token, body: { username: 'sharedname' } }),
      call('/api/auth/username', { method: 'POST', ip, token: cara.token, body: { username: 'sharedname' } })
    ])
    const won = [sharedBob, sharedCara].filter(item => item.status === 200)
    const lost = [sharedBob, sharedCara].filter(item => item.status === 409)
    assert.equal(won.length, 1, JSON.stringify([sharedBob, sharedCara].map(item => [item.status, item.json?.message])))
    assert.equal(lost.length, 1)
    assert.equal(lost[0].json.message, '这个用户名已经被占用了')
    const loserToken = sharedBob.status === 409 ? bob.token : cara.token
    const retry = await call('/api/auth/username', { method: 'POST', ip, token: loserToken, body: { username: 'afterclash' } })
    assert.equal(retry.status, 200, retry.text)
    assert.equal(retry.json.data.user.username, 'afterclash')
    const winnerToken = sharedBob.status === 200 ? bob.token : cara.token
    const winnerAgain = await call('/api/auth/username', { method: 'POST', ip, token: winnerToken, body: { username: 'sharedagain' } })
    assert.equal(winnerAgain.status, 400)
    assert.equal(winnerAgain.json.message, '用户名只能修改一次')
  })
})
