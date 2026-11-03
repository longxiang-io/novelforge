import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { db } from '../worker/db.js'
import { DEFAULT_WORLD } from '../worker/lib/book-defaults.js'
import { findSnippet, searchBook } from '../worker/lib/search.js'
import { startHarness } from './harness.js'

let harness
let alice
let bob

before(async () => {
  harness = await startHarness()
  const card = JSON.stringify({ role: '灯塔看守人的女儿' })
  const names = JSON.stringify(['林晚'])
  await harness.using(async () => {
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (1, 'alice@xs.local', 'alice', 'x', 'user', 'active')`)
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (2, 'bob@xs.local', 'bob', 'x', 'user', 'active')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title, world, outline) VALUES (1, 1, '夜航', '海边的灯塔镇', '主线是离开码头')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title, world) VALUES (2, 2, '另一本', '雨还没停也不该被搜到')`)
    await db.run(sql`INSERT INTO cj_volumes (id, user_id, book_id, sort, title, goal) VALUES (1, 1, 1, 1, '卷一', '先离开码头')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, goal, content, summary, status, characters) VALUES (1, 1, 1, 1, 1, '夜航', '把信交到柜台', '雨还没停。船靠在栈桥边。\n陈屿把信折好。', '信还没送到', 'confirmed', ${names})`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, content, status) VALUES (2, 1, 1, 1, 2, '封港', '未确认的秘密口令 a_b', 'draft')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, number, title, content, status) VALUES (3, 2, 2, 1, '别人的章', '雨还没停', 'confirmed')`)
    await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name, data) VALUES (1, 1, 1, 'character', '林晚', ${card})`)
    await db.run(sql`INSERT INTO cj_foreshadows (id, user_id, book_id, code, content, characters) VALUES (1, 1, 1, 'F001', '灯塔的第三封信', ${names})`)
  })
  alice = await harness.tokenFor(1)
  bob = await harness.tokenFor(2)
})

after(async () => {
  await harness?.dispose()
})

const search = (q, token = alice, book = 1) => harness.call(`/api/changjuan/books/${book}/search?q=${encodeURIComponent(q)}`, { token })

test('空白模板和空查询不会出结果', () => {
  const snippet = findSnippet(`  ${'甲'.repeat(30)}雨还没停。${'乙'.repeat(30)}`, '雨还没停')
  assert.match(snippet, /^…甲+雨还没停。乙+…$/)
  assert.equal(searchBook({ query: '力量体系', book: { world: DEFAULT_WORLD, outline: '' } }).length, 0)
  assert.equal(searchBook({ query: '   ', book: { world: '灯塔' } }).length, 0)
})

test('搜索能找到正文、细纲、世界观、人物和伏笔，看不到别人的书', async () => {
  const prose = await search('雨还没停')
  assert.equal(prose.status, 200)
  const body = prose.json.data.hits.filter(item => item.kind === 'prose')
  assert.equal(body.length, 1)
  assert.equal(body[0].chapter_id, 1)
  assert.equal(body[0].paragraph, 1)
  assert.equal(body[0].page, 'write')
  assert.match(body[0].snippet, /雨还没停/)

  const goal = await search('柜台')
  const outline = goal.json.data.hits.find(item => item.label === '本章目标')
  assert.equal(outline.page, 'outline')
  assert.equal(outline.outline_type, 'chapter')
  assert.equal(outline.outline_id, 1)

  const world = await search('灯塔镇')
  assert.equal(world.json.data.hits.some(item => item.kind === 'world' && item.outline_type === 'world'), true)

  const card = await search('看守人')
  assert.equal(card.json.data.hits.some(item => item.page === 'memory' && item.card === '林晚'), true)

  const clue = await search('第三封信')
  assert.equal(clue.json.data.hits.some(item => item.page === 'foreshadows' && item.foreshadow_id === 1), true)

  const draft = await search('秘密口令')
  assert.equal(draft.json.data.hits.some(item => item.chapter_id === 2 && item.kind === 'prose'), true)
})

test('百分号和下划线按字面查找', async () => {
  const wildcard = await search('%')
  assert.equal(wildcard.json.data.hits.length, 0)
  const underscore = await search('_')
  const ids = underscore.json.data.hits.filter(item => item.kind === 'prose').map(item => item.chapter_id)
  assert.deepEqual(ids, [2])
})

test('空查询返回空列表', async () => {
  const res = await search('')
  assert.equal(res.status, 200)
  assert.deepEqual(res.json.data.hits, [])
})

test('预览只含已确认章节，并按卷切开', async () => {
  const res = await harness.call('/api/changjuan/books/1/read', { token: alice })
  assert.equal(res.status, 200)
  assert.equal(res.json.data.volume_id, 1)
  assert.equal(res.json.data.volumes[0].title, '卷一')
  assert.equal(res.json.data.volumes[0].confirmed, 1)
  assert.deepEqual(res.json.data.chapters.map(item => item.number), [1])
  assert.match(res.json.data.chapters[0].content, /陈屿把信折好/)
  assert.equal(res.json.data.chapters[0].word_count > 0, true)

  const missing = await harness.call('/api/changjuan/books/1/read?volume=99', { token: alice })
  assert.equal(missing.json.data.volume_id, 1)
  assert.equal(missing.json.data.chapters.length, 1)
})

test('别人搜不到、也读不到这本书', async () => {
  const found = await search('雨还没停', bob)
  assert.equal(found.status, 404)
  const read = await harness.call('/api/changjuan/books/1/read', { token: bob })
  assert.equal(read.status, 404)
  const own = await search('雨还没停', bob, 2)
  assert.equal(own.status, 200)
  assert.equal(own.json.data.hits.some(item => item.chapter_id === 3), true)
})
