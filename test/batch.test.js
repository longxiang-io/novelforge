import { readFile } from 'node:fs/promises'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { Miniflare } from 'miniflare'
import { sql } from 'drizzle-orm'
import { createDb, db, runWithDbInstance } from '../worker/db.js'
import { applyChanges, revertStatements, restoreCardStatementFor } from '../worker/lib/memory.js'

let mf
let d1
let orm

const using = (fn) => runWithDbInstance(orm, fn)

before(async () => {
  mf = new Miniflare({
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
  d1 = await mf.getD1Database('DB')
  const schema = (await readFile(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'))
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
  for (const statement of schema.split(';').map(item => item.trim()).filter(Boolean)) {
    await d1.prepare(statement).run()
  }
  orm = createDb(d1)
})

after(async () => {
  await mf?.dispose()
})

const clear = () => d1.exec(`
  DELETE FROM cj_issues;
  DELETE FROM cj_changes;
  DELETE FROM cj_versions;
  DELETE FROM cj_usage;
  DELETE FROM cj_foreshadows;
  DELETE FROM cj_cards;
  DELETE FROM cj_chapters;
  DELETE FROM cj_volumes;
  DELETE FROM cj_books;
  DELETE FROM cj_providers;
  DELETE FROM cj_settings;
  DELETE FROM users;
`)

describe('D1 batch', { concurrency: false }, () => {
  test('空批次不访问数据库', async () => {
    await using(async () => {
      assert.deepEqual(await db.batch([]), [])
    })
  })

  test('后面的语句失败时，前面的插入也不保留', async () => {
    await clear()
    await using(async () => {
      await db.run(sql`INSERT INTO users (email, username, password_hash) VALUES ('a@b.c', 'ann', 'x')`)
      await assert.rejects(() => db.batch([
        sql`INSERT INTO users (email, username, password_hash) VALUES ('c@d.e', 'cee', 'x')`,
        sql`INSERT INTO users (email, username, password_hash) VALUES ('a@b.c', 'dup', 'x')`
      ]))
      assert.equal(await db.get(sql`SELECT id FROM users WHERE username = 'cee'`), undefined)
      assert.equal((await db.get(sql`SELECT username FROM users WHERE email = 'a@b.c'`)).username, 'ann')
    })
  })

  test('同一批次里可以用 last_insert_rowid 写下一条', async () => {
    await clear()
    await using(async () => {
      const results = await db.batch([
        sql`INSERT INTO cj_books (user_id, title) VALUES (1, '新书')`,
        sql`INSERT INTO cj_volumes (user_id, book_id, sort, title) VALUES (1, last_insert_rowid(), 1, '卷一')`
      ])
      const bookId = Number(results[0].lastInsertRowid)
      const volume = await db.get(sql`SELECT book_id, title FROM cj_volumes WHERE book_id = ${bookId}`)
      assert.equal(volume.title, '卷一')
      assert.equal(volume.book_id, bookId)
    })
  })

  test('确认改动要么全部写下，要么卡片和伏笔都不变', async () => {
    await clear()
    await using(async () => {
      await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (1, 1, '书')`)
      await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, number, content) VALUES (1, 1, 1, 1, '正文')`)
      await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name, data) VALUES (1, 1, 1, 'character', '阿宁', ${JSON.stringify({ alive: '是', location: '城南' })})`)
      await db.run(sql`INSERT INTO cj_foreshadows (id, user_id, book_id, code, content) VALUES (1, 1, 1, 'F001', '旧伏笔')`)
      const changes = [
        { kind: 'state', target_name: '阿宁', field: 'location', new_value: '城北', payload: {}, edited: 0 },
        { kind: 'new_character', target_name: '老周', new_value: '掌柜', payload: { name: '老周', data: { role: '掌柜' } }, edited: 0 },
        { kind: 'new_foreshadow', new_value: '玉佩', payload: { characters: ['阿宁'], planned_chapter: 8 }, edited: 0 },
        { kind: 'resolve_foreshadow', target_name: 'F001', payload: {}, edited: 0 }
      ]
      const planned = await applyChanges({ userId: 1, book: { id: 1 }, chapter: { id: 1, number: 3 }, changes })
      assert.equal(planned.details.find(item => item.target_name === '老周').target_id, 2)
      assert.equal(planned.details.find(item => item.field === 'created' && item.target_type === 'foreshadow').target_name, 'F002')

      await assert.rejects(() => db.batch([
        ...planned.statements,
        sql`INSERT INTO missing_table (id) VALUES (1)`
      ]))
      assert.match((await db.get(sql`SELECT data FROM cj_cards WHERE id = 1`)).data, /城南/)
      assert.equal(await db.get(sql`SELECT id FROM cj_cards WHERE name = '老周'`), undefined)
      assert.equal(await db.get(sql`SELECT id FROM cj_foreshadows WHERE content = '玉佩'`), undefined)
      assert.equal((await db.get(sql`SELECT status FROM cj_foreshadows WHERE code = 'F001'`)).status, 'open')

      const versionIndex = planned.statements.length
      const results = await db.batch([
        ...planned.statements,
        sql`
          INSERT INTO cj_versions (user_id, book_id, chapter_id, chapter_number, label, content, changes, before_state, after_state)
          VALUES (1, 1, 1, 3, '确认', '正文', ${JSON.stringify(planned.details)}, ${JSON.stringify(planned.before)}, ${JSON.stringify(planned.after)})
        `,
        sql`UPDATE cj_chapters SET status = 'confirmed' WHERE id = 1`,
        sql`DELETE FROM ${sql.identifier('cj_usage')} WHERE book_id = ${1} AND user_id = ${1}`
      ])
      const versionId = Number(results[versionIndex].lastInsertRowid)
      assert.ok(versionId > 0)
      assert.equal(JSON.parse((await db.get(sql`SELECT data FROM cj_cards WHERE id = 1`)).data).location, '城北')
      const zhou = JSON.parse((await db.get(sql`SELECT data FROM cj_cards WHERE name = '老周'`)).data)
      assert.equal(zhou.role, '掌柜')
      assert.equal(zhou.alive, '是')
      assert.equal(zhou.present, '是')
      assert.equal((await db.get(sql`SELECT status, resolved_chapter FROM cj_foreshadows WHERE code = 'F001'`)).status, 'resolved')
      const planted = await db.get(sql`SELECT code, planned_chapter FROM cj_foreshadows WHERE content = '玉佩'`)
      assert.equal(planted.code, 'F002')
      assert.equal(planted.planned_chapter, 8)
      const before = JSON.parse((await db.get(sql`SELECT before_state FROM cj_versions WHERE id = ${versionId}`)).before_state)
      assert.equal(before.cards['1'].data.location, '城南')
      assert.equal(before.cards['2'], null)

      const version = await db.get(sql`SELECT * FROM cj_versions WHERE id = ${versionId}`)
      const cardSql = restoreCardStatementFor(1, version, 1)
      assert.ok(cardSql)
      assert.equal(restoreCardStatementFor(1, version, 99), null)
      await db.batch(revertStatements(1, version))
      assert.equal(JSON.parse((await db.get(sql`SELECT data FROM cj_cards WHERE id = 1`)).data).location, '城南')
      assert.equal(await db.get(sql`SELECT id FROM cj_cards WHERE name = '老周'`), undefined)
      assert.equal(await db.get(sql`SELECT id FROM cj_foreshadows WHERE code = 'F002'`), undefined)
      assert.equal((await db.get(sql`SELECT status FROM cj_foreshadows WHERE code = 'F001'`)).status, 'open')
      assert.equal((await db.get(sql`SELECT status FROM cj_chapters WHERE id = 1`)).status, 'draft')
      assert.equal((await db.get(sql`SELECT reverted FROM cj_versions WHERE id = ${versionId}`)).reverted, 1)
    })
  })
})
