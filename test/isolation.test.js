import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { db } from '../worker/db.js'
import { hashPassword } from '../worker/lib/password.js'
import { startHarness } from './harness.js'

let harness
let alice
let bob
let cara

const owned = [
  ['GET', '/api/changjuan/books/1'],
  ['PUT', '/api/changjuan/books/1', { title: '偷来的书' }],
  ['DELETE', '/api/changjuan/books/1'],
  ['GET', '/api/changjuan/books/1/cards'],
  ['GET', '/api/changjuan/books/1/foreshadows'],
  ['GET', '/api/changjuan/books/1/read'],
  ['GET', '/api/changjuan/books/1/search?q=%E6%AD%A3%E6%96%87'],
  ['GET', '/api/changjuan/books/1/stats'],
  ['GET', '/api/changjuan/books/1/versions'],
  ['GET', '/api/changjuan/books/1/export'],
  ['GET', '/api/changjuan/books/1/export-txt?from=1&to=1'],
  ['POST', '/api/changjuan/volumes', { book_id: 1, title: '偷来的卷' }],
  ['PUT', '/api/changjuan/volumes/1', { title: '偷来的卷' }],
  ['DELETE', '/api/changjuan/volumes/1'],
  ['POST', '/api/changjuan/chapters', { book_id: 1, title: '偷来的章' }],
  ['GET', '/api/changjuan/chapters/1'],
  ['PUT', '/api/changjuan/chapters/1', { title: '偷来的章', content: '改掉' }],
  ['DELETE', '/api/changjuan/chapters/1'],
  ['GET', '/api/changjuan/chapters/1/context'],
  ['POST', '/api/changjuan/chapters/1/check', {}],
  ['POST', '/api/changjuan/chapters/1/confirm', {}],
  ['POST', '/api/changjuan/chapters/1/extract', { skip_model: true }],
  ['POST', '/api/changjuan/chapters/1/generate', {}],
  ['POST', '/api/changjuan/chapters/1/summary', {}],
  ['POST', '/api/changjuan/cards', { book_id: 1, kind: 'character', name: '偷来的人' }],
  ['PUT', '/api/changjuan/cards/1', { name: '偷来的人' }],
  ['DELETE', '/api/changjuan/cards/1'],
  ['GET', '/api/changjuan/cards/1/history'],
  ['POST', '/api/changjuan/foreshadows', { book_id: 1, content: '偷来的伏笔' }],
  ['PUT', '/api/changjuan/foreshadows/1', { content: '偷来的伏笔' }],
  ['DELETE', '/api/changjuan/foreshadows/1'],
  ['PUT', '/api/changjuan/changes/1', { decision: 'rejected' }],
  ['PUT', '/api/changjuan/issues/1', { false_positive: true, reason: '其他' }],
  ['GET', '/api/changjuan/versions/1'],
  ['POST', '/api/changjuan/versions/1/revert', {}],
  ['POST', '/api/changjuan/versions/1/restore-card', { card_id: 1 }],
  ['POST', '/api/changjuan/testcases', { id: 1, title: '偷来的用例', content: '正文里有错', expected: [{ keyword: '错' }] }],
  ['DELETE', '/api/changjuan/testcases/1']
]

before(async () => {
  harness = await startHarness()
  const passwordHash = await hashPassword('secret-pass')
  await harness.using(async () => {
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (1, 'alice@xs.local', 'alice', ${passwordHash}, 'user', 'active')`)
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (2, 'bob@xs.local', 'bob', ${passwordHash}, 'user', 'active')`)
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (3, 'cara@xs.local', 'cara', ${passwordHash}, 'user', 'disabled')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (1, 1, '爱丽丝的书')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (2, 2, '鲍勃的书')`)
    await db.run(sql`INSERT INTO cj_volumes (id, user_id, book_id, sort, title) VALUES (1, 1, 1, 1, '卷一')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, content) VALUES (1, 1, 1, 1, 1, '开篇', '正文')`)
    await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name) VALUES (1, 1, 1, 'character', '阿宁')`)
    await db.run(sql`INSERT INTO cj_foreshadows (id, user_id, book_id, code, content) VALUES (1, 1, 1, 'F001', '玉佩')`)
    await db.run(sql`INSERT INTO cj_issues (id, user_id, book_id, chapter_id, title) VALUES (1, 1, 1, 1, '矛盾')`)
    await db.run(sql`INSERT INTO cj_changes (id, user_id, book_id, chapter_id, kind, target_name) VALUES (1, 1, 1, 1, 'state', '阿宁')`)
    await db.run(sql`INSERT INTO cj_versions (id, user_id, book_id, chapter_id, chapter_number, label) VALUES (1, 1, 1, 1, 1, '确认')`)
    await db.run(sql`INSERT INTO cj_testcases (id, user_id, title, content, expected) VALUES (1, 1, '用例', '正文', '[]')`)
    await db.run(sql`INSERT INTO cj_usage (user_id, book_id, chapter_id, task, cost) VALUES (1, 1, 1, 'generate', 9)`)
    await db.run(sql`INSERT INTO cj_usage (user_id, book_id, chapter_id, task, cost) VALUES (1, 2, NULL, 'generate', 50)`)
    await db.run(sql`INSERT INTO cj_usage (user_id, book_id, chapter_id, task, cost) VALUES (2, 2, NULL, 'generate', 2)`)
  })
  alice = await harness.tokenFor(1)
  bob = await harness.tokenFor(2)
  cara = await harness.tokenFor(3)
})

after(async () => {
  await harness?.dispose()
})

describe('数据隔离', { concurrency: false }, () => {
  test('两个用户互相访问对方资源得到 404，用量只算自己的', async () => {
    const { call } = harness
    for (const [method, path, body] of owned) {
      const res = await call(path, { method, token: bob, body })
      assert.equal(res.status, 404, `${method} ${path} -> ${res.status} ${res.text}`)
    }

    const ownBook = await call('/api/changjuan/books/1', { token: alice })
    assert.equal(ownBook.status, 200)
    assert.equal(ownBook.json.data.book.title, '爱丽丝的书')
    assert.equal(Number(ownBook.json.data.total_cost), 9)

    const ownChapter = await call('/api/changjuan/chapters/1', { token: alice })
    assert.equal(ownChapter.status, 200)
    assert.equal(ownChapter.json.data.content, '正文')

    const aliceShelf = await call('/api/changjuan/books', { token: alice })
    assert.equal(aliceShelf.status, 200)
    assert.deepEqual(aliceShelf.json.data.books.map(item => item.title), ['爱丽丝的书'])
    assert.equal(Number(aliceShelf.json.data.month.cost), 59)

    const bobShelf = await call('/api/changjuan/books', { token: bob })
    assert.deepEqual(bobShelf.json.data.books.map(item => item.title), ['鲍勃的书'])
    assert.equal(Number(bobShelf.json.data.month.cost), 2)

    const bobStats = await call('/api/changjuan/books/2/stats', { token: bob })
    assert.equal(bobStats.status, 200)
    assert.equal(Number(bobStats.json.data.total_cost), 2)

    const aliceCases = await call('/api/changjuan/testcases', { token: alice })
    assert.equal(aliceCases.json.data.list.length, 1)
    const bobCases = await call('/api/changjuan/testcases', { token: bob })
    assert.equal(bobCases.json.data.list.length, 0)

    const title = await harness.using(() => db.get(sql`SELECT title FROM cj_books WHERE id = 1`))
    const content = await harness.using(() => db.get(sql`SELECT content FROM cj_chapters WHERE id = 1`))
    assert.equal(title.title, '爱丽丝的书')
    assert.equal(content.content, '正文')
  })

  test('禁用账号不能登录，旧令牌也是 401', async () => {
    const { call } = harness
    const login = await call('/api/auth/login', { method: 'POST', body: { account: 'cara', password: 'secret-pass' } })
    assert.equal(login.status, 401)
    const books = await call('/api/changjuan/books', { token: cara })
    assert.equal(books.status, 401)
    const me = await call('/api/auth/me', { token: cara })
    assert.equal(me.status, 401)

    const ok = await call('/api/auth/login', { method: 'POST', body: { account: 'bob', password: 'secret-pass' } })
    assert.equal(ok.status, 200)
    assert.equal(ok.json.data.user.username, 'bob')
  })
})
