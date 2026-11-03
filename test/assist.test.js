import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sql } from 'drizzle-orm'
import { db } from '../worker/db.js'
import worker from '../worker/index.js'
import { hashPassword } from '../worker/lib/password.js'
import { buildAssistContext, contextPhrase } from '../worker/lib/assist-context.js'
import { planAssistApply, planCreateBook } from '../worker/lib/assist-apply.js'
import {
  cleanCardFields, cleanChapterFields, cleanNewBookFields, interpretReply, markerHoldLength, splitSuggestionText
} from '../worker/lib/assist-schema.js'
import { DEFAULT_OUTLINE } from '../worker/lib/book-defaults.js'
import { startHarness } from './harness.js'

let harness
let token

const call = (path, options = {}) => harness.call(path, options)
const row = (query) => harness.using(() => db.get(query))
const rows = (query) => harness.using(() => db.all(query))

const withFetch = async (handler, fn) => {
  const real = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('example.test')) return real(url, init)
    return handler(url, init)
  }
  try {
    return await fn()
  } finally {
    globalThis.fetch = real
  }
}

const sse = (text) => [
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
  '',
  'data: {"usage":{"prompt_tokens":11,"completion_tokens":7}}',
  '',
  'data: [DONE]',
  ''
].join('\n')

const eventsOf = (text) => String(text || '').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))

const saveProvider = async (tasks) => {
  const saved = await call('/api/changjuan/config', {
    method: 'PUT',
    token,
    body: {
      providers: [{ name: '假模型', base_url: 'https://example.test/v1', api_key: 'sk-test-assist', key_storage: 'server' }],
      tasks: {}
    }
  })
  assert.equal(saved.status, 200, saved.text)
  const id = saved.json.data.providers[0].id
  const tasked = await call('/api/changjuan/config', {
    method: 'PUT',
    token,
    body: {
      providers: [{ id, name: '假模型', base_url: 'https://example.test/v1', api_key: '', key_storage: 'server' }],
      tasks
    }
  })
  assert.equal(tasked.status, 200, tasked.text)
  return id
}

const marker = (payload) => `先说一句。\n<<<cj-suggestions>>>\n${JSON.stringify(payload)}\n<<<end>>>`

before(async () => {
  harness = await startHarness()
  const passwordHash = await hashPassword('password1')
  await harness.using(async () => {
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (1, 'ann@xs.local', 'ann', ${passwordHash}, 'user', 'active')`)
    await db.run(sql`INSERT INTO users (id, email, username, password_hash, role, status) VALUES (2, 'bob@xs.local', 'bob', ${passwordHash}, 'user', 'active')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title, world, outline) VALUES (1, 1, '安的书', '原世界观', '原总纲')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (2, 2, '鲍勃的书')`)
    await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (3, 1, '安的另一本')`)
    await db.run(sql`INSERT INTO cj_volumes (id, user_id, book_id, sort, title, goal) VALUES (1, 1, 1, 1, '卷一', '')`)
    await db.run(sql`INSERT INTO cj_volumes (id, user_id, book_id, sort, title) VALUES (2, 2, 2, 1, '鲍勃卷一')`)
    await db.run(sql`INSERT INTO cj_volumes (id, user_id, book_id, sort, title) VALUES (3, 1, 3, 1, '另一卷')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, goal, content, status) VALUES (1, 1, 1, 1, 1, '开篇', '', '正文保留', 'confirmed')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, goal) VALUES (2, 2, 2, 2, 1, '别人的章', '别动')`)
    await db.run(sql`INSERT INTO cj_chapters (id, user_id, book_id, volume_id, number, title, goal) VALUES (3, 1, 3, 3, 1, '另一章', '另一目标')`)
    await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name, data) VALUES (1, 1, 1, 'character', '沈默', '{"role":"","alive":"是","present":"是"}')`)
    await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name, category, data) VALUES (2, 1, 1, 'setting', '铁律', '规则', '{"content":"","pinned":true}')`)
  })
  token = await harness.tokenFor(1)
})

after(async () => {
  await harness?.dispose()
})

describe('建议解析', () => {
  test('非法 JSON 当普通文字，未知字段和超范围数字丢掉', () => {
    const broken = splitSuggestionText('随便聊聊 <<<cj-suggestions>>> {')
    assert.equal(broken.parsed, false)
    assert.equal(broken.content.includes('随便聊聊'), true)
    const chapter = cleanChapterFields({ content: '不要写正文', foo: '不要', goal: '冲突升级', target_words: 10, 冲突: '更狠', characters: '沈默、阿宁' })
    assert.equal(chapter.content, undefined)
    assert.equal(chapter.foo, undefined)
    assert.equal(chapter.target_words, undefined)
    assert.equal(chapter.goal, '冲突升级')
    assert.equal(chapter.conflict, '更狠')
    assert.deepEqual(chapter.characters, ['沈默', '阿宁'])
    assert.equal(cleanChapterFields({ foreshadows: [1, '坏'], goal: '留下' }).foreshadows, undefined)
    assert.equal(cleanChapterFields({ foreshadows: [1, '坏'] }), null)
    assert.equal(cleanCardFields({ kind: 'setting', name: '门规', category: '不存在', content: '不行' }, { creating: true }), null)
    assert.equal(cleanCardFields({ name: '沈默', pinned: 'false', content: '补一段' }).data.pinned, false)
    assert.equal(cleanCardFields({ name: '沈默', pinned: 'false', content: '补一段' }).data.content, '补一段')
  })

  test('不属于当前书的目标不会留下，建书方案会跳过坏掉的子项', () => {
    const scope = {
      bookId: 1,
      allowNewBook: false,
      volumeIds: new Set([1]),
      chapterIds: new Set([1]),
      cardIds: new Set([1]),
      cards: [{ id: 1, kind: 'character', name: '沈默', data: {} }]
    }
    const text = marker({
      suggestions: [
        { target_type: 'chapter', target_id: 1, fields: { goal: '可以改' } },
        { target_type: 'chapter', target_id: 2, fields: { goal: '别人的章' } },
        { target_type: 'chapter', target_id: 3, fields: { goal: '另一本书' } },
        { target_type: 'book', fields: { outline: '新总纲' } }
      ]
    })
    const reply = interpretReply(text, { target_type: 'chapter', target_id: 1, book_id: 1 }, scope)
    assert.deepEqual(reply.suggestions.map(item => item.fields.goal || item.fields.outline), ['可以改', '新总纲'])
    assert.equal(reply.content, '先说一句。')
    const plan = cleanNewBookFields({
      title: '新书',
      volumes: [{ title: '', goal: '没卷名' }, { title: '卷一', goal: '开局', chapters: [{ goal: '' }, { number: 2, title: '夜奔', goal: '逃走' }] }],
      cards: [{ kind: 'character', name: '沈默', role: '游侠' }, { kind: 'setting', name: '坏设定', category: '不存在', content: '不要' }]
    })
    assert.equal(plan.volumes.length, 1)
    assert.equal(plan.volumes[0].chapters.length, 1)
    assert.equal(plan.cards.length, 1)
    assert.equal(plan.cards[0].data.role, '游侠')
  })

  test('标记还没写完时先按住前缀', () => {
    const partial = '好的<<<cj-sugges'
    assert.equal(markerHoldLength(partial), '好的'.length)
    assert.equal(markerHoldLength(`好的\n<<<cj-suggestions>>>`), '好的\n'.length)
  })
})

describe('上下文裁剪', () => {
  const scope = {
    book: { title: '测试书', world: `世${'界'.repeat(4000)}`, outline: `纲${'要'.repeat(4000)}` },
    volumes: [{ id: 1, title: '卷一', goal: '活过冬天', outline: '分卷大纲' }],
    chapters: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      number: index + 1,
      volume_id: 1,
      title: `章${index + 1}`,
      goal: `目标${index + 1}`,
      conflict: '',
      payoff: '',
      hook: '',
      characters: index === 4 ? ['沈默'] : [],
      summary: index === 2 ? '摘要甲' : '',
      status: index === 3 ? 'confirmed' : 'draft',
      content: '不应出现的正文UNIQUE'
    })),
    cards: [
      { id: 1, kind: 'setting', name: '铁律', data: { pinned: true, content: '不许杀人' } },
      { id: 2, kind: 'character', name: '沈默', data: { role: '主角', personality: '冷' } },
      { id: 3, kind: 'character', name: '路人甲', data: { role: '路人' } }
    ]
  }

  test('只带相邻细纲和摘要，不带正文', () => {
    const context = buildAssistContext(scope, { targetType: 'chapter', targetId: 5, limits: { maxChars: 12000, neighbor: 2, maxCards: 12 } })
    assert.equal(context.text.includes('不应出现的正文UNIQUE'), false)
    assert.equal(context.text.includes('摘要甲'), true)
    assert.equal(context.text.includes('已确认，暂无摘要'), true)
    assert.equal(context.text.includes('铁律'), true)
    assert.equal(context.text.includes('路人甲'), false)
    assert.equal(context.neighborChapters, 4)
    assert.equal(context.cards >= 2, true)
    assert.equal(contextPhrase({ targetType: 'chapter', cards: context.cards, neighborChapters: context.neighborChapters, trimmed: false }), `已带上 ${context.cards} 张卡片、前后 ${context.neighborChapters} 章`)
  })

  test('超长时裁剪，置顶卡还在', () => {
    const context = buildAssistContext(scope, { targetType: 'chapter', targetId: 5, limits: { maxChars: 180, neighbor: 3, maxCards: 12 } })
    assert.equal(context.trimmed, true)
    assert.equal(context.text.length <= 180, true)
    assert.equal(context.text.includes('铁律'), true)
    assert.equal(context.text.includes('不应出现的正文UNIQUE'), false)
    assert.match(contextPhrase({ targetType: 'book', cards: 2, neighborChapters: 1, trimmed: true }), /已带上 2 张卡片、前后 1 章（上下文已裁剪）/)
  })
})

describe('对话、应用和建书', { concurrency: false }, () => {
  test('没配模型时返回 not_configured，并且不落下消息', async () => {
    const model = await call('/api/changjuan/ai/model', { token })
    assert.equal(model.status, 200)
    assert.equal(model.json.data.ready, false)
    const chat = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { book_id: 1, target_type: 'chapter', target_id: 1 } })
    assert.equal(chat.status, 200, chat.text)
    const sent = await call(`/api/changjuan/ai/chats/${chat.json.data.id}/messages`, { method: 'POST', token, body: { content: '帮我改' } })
    assert.equal(sent.status, 400, sent.text)
    assert.equal(sent.json.error_type, 'not_configured')
    const count = await row(sql`SELECT COUNT(*) AS total FROM cj_ai_messages WHERE chat_id = ${chat.json.data.id}`)
    assert.equal(Number(count.total), 0)
    const other = await call(`/api/changjuan/ai/chats/${chat.json.data.id}`, { token: await harness.tokenFor(2) })
    assert.equal(other.status, 404)
  })

  test('流式回复解析建议，应用后能回滚，失败则整批不动', async () => {
    await saveProvider({ assist: { provider_id: null, model: 'assist-model', price_in: 1, price_out: 2 } })
    const configured = await call('/api/changjuan/config', { token })
    const providerId = configured.json.data.providers[0].id
    await call('/api/changjuan/config', {
      method: 'PUT',
      token,
      body: {
        providers: [{ id: providerId, name: '假模型', base_url: 'https://example.test/v1', api_key: '', key_storage: 'server' }],
        tasks: { assist: { provider_id: providerId, model: 'assist-model', price_in: 1, price_out: 2 } }
      }
    })
    const chat = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { book_id: 1, target_type: 'chapter', target_id: 1, title: '开篇细纲' } })
    const text = marker({ suggestions: [{ target_type: 'chapter', fields: { goal: '把冲突写狠', conflict: '雪夜追杀' } }, { target_type: 'card', target_id: 'new', fields: { kind: 'character', name: '阿宁', role: '师妹' } }] })
    let seenModel = ''
    const sent = await withFetch(async (_url, init) => {
      seenModel = JSON.parse(init.body).model
      return new Response(sse(text), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }, () => call(`/api/changjuan/ai/chats/${chat.json.data.id}/messages`, { method: 'POST', token, body: { content: '帮我把这一章的冲突写得更狠，并加一个师妹' } }))
    assert.equal(sent.status, 200, sent.text)
    assert.equal(seenModel, 'assist-model')
    assert.equal(sent.text.includes('<<<cj-suggestions>>>'), false)
    const done = eventsOf(sent.text).find(item => item.type === 'done')
    assert.equal(done.content, '先说一句。')
    const usage = await row(sql`SELECT task, output_chars, book_id, chapter_id FROM cj_usage WHERE user_id = 1 ORDER BY id DESC`)
    assert.equal(usage.task, 'assist')
    assert.equal(usage.output_chars, 0)
    assert.equal(usage.book_id, 1)
    assert.equal(usage.chapter_id, 1)
    const view = await call(`/api/changjuan/ai/chats/${chat.json.data.id}`, { token })
    const assistant = view.json.data.messages.find(item => item.role === 'assistant')
    assert.equal(assistant.suggestions.length, 2)
    const applied = await call(`/api/changjuan/ai/chats/${chat.json.data.id}/apply`, {
      method: 'POST',
      token,
      body: { message_id: assistant.id, all: true }
    })
    assert.equal(applied.status, 200, applied.text)
    const chapter = await row(sql`SELECT goal, conflict, content, status FROM cj_chapters WHERE id = 1`)
    assert.equal(chapter.goal, '把冲突写狠')
    assert.equal(chapter.content, '正文保留')
    assert.equal(chapter.status, 'confirmed')
    const card = await row(sql`SELECT name FROM cj_cards WHERE book_id = 1 AND name = '阿宁'`)
    assert.equal(card.name, '阿宁')
    const version = await row(sql`SELECT id, chapter_id, stats FROM cj_versions WHERE book_id = 1 ORDER BY id DESC`)
    assert.equal(version.chapter_id, 0)
    assert.equal(JSON.parse(version.stats).source, 'assist')
    const reverted = await call(`/api/changjuan/versions/${version.id}/revert`, { method: 'POST', token })
    assert.equal(reverted.status, 200, reverted.text)
    const restored = await row(sql`SELECT goal, content, status FROM cj_chapters WHERE id = 1`)
    assert.equal(restored.goal, '')
    assert.equal(restored.content, '正文保留')
    assert.equal(restored.status, 'confirmed')
    assert.equal(await row(sql`SELECT id FROM cj_cards WHERE name = '阿宁'`), undefined)

    const foreign = await harness.using(async () => {
      const messageId = (await db.run(sql`
        INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
        VALUES (${chat.json.data.id}, 1, 'assistant', '不行', ${JSON.stringify([{ id: 's1', target_type: 'chapter', target_id: 2, fields: { goal: '偷改' }, status: 'pending' }, { id: 's2', target_type: 'chapter', target_id: 3, fields: { goal: '跨书' }, status: 'pending' }])})
      `)).lastInsertRowid
      return Number(messageId)
    })
    const rejected = await call(`/api/changjuan/ai/chats/${chat.json.data.id}/apply`, { method: 'POST', token, body: { message_id: foreign, ids: ['s1'] } })
    assert.equal(rejected.status, 400, rejected.text)
    assert.equal((await row(sql`SELECT goal FROM cj_chapters WHERE id = 2`)).goal, '别动')
    assert.equal((await row(sql`SELECT goal FROM cj_chapters WHERE id = 3`)).goal, '另一目标')

    const plan = await harness.using(async () => {
      const message = await db.get(sql`SELECT * FROM cj_ai_messages WHERE id = ${assistant.id}`)
      message.suggestions = JSON.stringify([{ id: 's1', target_type: 'chapter', target_id: 1, fields: { goal: '不该留下' }, status: 'pending' }])
      const currentChat = await db.get(sql`SELECT * FROM cj_ai_chats WHERE id = ${chat.json.data.id}`)
      return planAssistApply({ userId: 1, chat: currentChat, message, ids: ['s1'], all: false, ignoreIds: [], edits: null })
    })
    await harness.using(async () => {
      await assert.rejects(() => db.batch([
        ...plan.statements,
        sql`INSERT INTO cj_books (id, user_id, title) VALUES (1, 1, '撞车')`
      ]))
      assert.equal((await db.get(sql`SELECT goal FROM cj_chapters WHERE id = 1`)).goal, '')
    })
  })

  test('没配和 AI 聊时改用生成正文的模型，用量仍记 assist', async () => {
    const panel = await readFile(new URL('../src/views/changjuan/components/AiChatPanel.vue', import.meta.url), 'utf8')
    const zh = await readFile(new URL('../src/locales/fragments/rest.zh-CN.json', import.meta.url), 'utf8')
    assert.equal(panel.includes("rest.chat.fallback"), true)
    assert.equal(zh.includes('暂时使用「生成正文」的模型'), true)
    assert.equal(panel.includes('大纲任务'), false)
    assert.equal(zh.includes('大纲任务'), false)
    const configured = await call('/api/changjuan/config', { token })
    const providerId = configured.json.data.providers[0].id
    await call('/api/changjuan/config', {
      method: 'PUT',
      token,
      body: {
        providers: [{ id: providerId, name: '假模型', base_url: 'https://example.test/v1', api_key: '', key_storage: 'server' }],
        tasks: {
          assist: { provider_id: null, model: '' },
          generate: { provider_id: providerId, model: 'outline-model', price_in: 1, price_out: 1 }
        }
      }
    })
    const model = await call('/api/changjuan/ai/model', { token })
    assert.equal(model.json.data.fallback, true)
    assert.equal(model.json.data.source, 'generate')
    const chat = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { book_id: 1, target_type: 'book', target_id: 1 } })
    let seenModel = ''
    const sent = await withFetch(async (_url, init) => {
      seenModel = JSON.parse(init.body).model
      return new Response(sse('只是聊聊'), { status: 200 })
    }, () => call(`/api/changjuan/ai/chats/${chat.json.data.id}/messages`, { method: 'POST', token, body: { content: '总纲怎么写' } }))
    assert.equal(sent.status, 200, sent.text)
    assert.equal(seenModel, 'outline-model')
    const usage = await row(sql`SELECT task, model FROM cj_usage WHERE user_id = 1 ORDER BY id DESC`)
    assert.equal(usage.task, 'assist')
    assert.equal(usage.model, 'outline-model')
  })

  test('客户端断开后仍保存后半段回复', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const real = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      if (!String(url).includes('example.test')) return real(url, init)
      const encoder = new TextEncoder()
      return new Response(new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"前半"}}]}\n\n'))
          await gate
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"后半"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: {"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }
    try {
      const chat = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { book_id: 1, target_type: 'volume', target_id: 1 } })
      const response = await worker.fetch(new Request(`http://127.0.0.1/api/changjuan/ai/chats/${chat.json.data.id}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '接着说' })
      }), harness.env, { waitUntil() {}, passThroughOnException() {} })
      const reader = response.body.getReader()
      const first = await reader.read()
      const decoder = new TextDecoder()
      assert.equal(decoder.decode(first.value).includes('后半'), false)
      await reader.cancel()
      release()
      let saved = null
      for (let index = 0; index < 40; index += 1) {
        saved = await row(sql`SELECT content FROM cj_ai_messages WHERE chat_id = ${chat.json.data.id} AND role = 'assistant'`)
        if (saved?.content?.includes('后半')) break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      assert.equal(saved.content.includes('前半后半') || saved.content.includes('后半'), true)
    } finally {
      release()
      globalThis.fetch = real
    }
  })

  test('建书建议可以只留书名，重复章号会拒绝，失败时不留下半本书', async () => {
    const chat = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { target_type: 'new_book', title: '夜航构思' } })
    assert.equal(chat.json.data.book_id, null)
    const messageId = await harness.using(async () => Number((await db.run(sql`
      INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
      VALUES (${chat.json.data.id}, 1, 'assistant', '可以建', ${JSON.stringify([{
        id: 's1', target_type: 'new_book', target_id: 'new', status: 'pending',
        fields: {
          title: '夜航',
          chapter_words: 3000,
          outline: '主线是返乡',
          volumes: [{ title: '卷一', goal: '离城', chapters: [{ number: 1, title: '雨', goal: '动身' }, { number: 1, title: '重复', goal: '不行' }] }],
          cards: [{ kind: 'setting', name: '夜禁', category: '规则', content: '亥时关城', pinned: true }]
        }
      }])})
    `)).lastInsertRowid))
    const currentChat = await row(sql`SELECT * FROM cj_ai_chats WHERE id = ${chat.json.data.id}`)
    const currentMessage = await row(sql`SELECT * FROM cj_ai_messages WHERE id = ${messageId}`)
    await assert.rejects(() => harness.using(() => planCreateBook({ userId: 1, chat: currentChat, message: currentMessage, suggestionId: 's1' })), /第 1 章已存在/)
    assert.equal(await row(sql`SELECT id FROM cj_books WHERE title = '夜航'`), undefined)

    const message = { ...currentMessage, suggestions: JSON.stringify([{ id: 's1', target_type: 'new_book', target_id: 'new', status: 'pending', fields: { title: '夜航', outline: '主线是返乡' } }]) }
    const plan = await harness.using(() => planCreateBook({ userId: 1, chat: currentChat, message, suggestionId: 's1', plan: { title: '夜航' } }))
    await harness.using(async () => {
      await assert.rejects(() => db.batch([
        ...plan.statements,
        sql`INSERT INTO users (id, email, username, password_hash) VALUES (1, 'dup@xs.local', 'dup', 'x')`
      ]))
      assert.equal(await db.get(sql`SELECT id FROM cj_books WHERE title = '夜航'`), undefined)
      assert.equal((await db.get(sql`SELECT book_id FROM cj_ai_chats WHERE id = ${chat.json.data.id}`)).book_id, null)
    })

    const created = await call(`/api/changjuan/ai/chats/${chat.json.data.id}/create-book`, {
      method: 'POST',
      token,
      body: {
        message_id: messageId,
        suggestion_id: 's1',
        plan: {
          title: '夜航',
          outline: '主线是返乡',
          volumes: [{ title: '卷一', goal: '离城', chapters: [{ title: '雨', goal: '动身' }] }],
          cards: [{ kind: 'setting', name: '夜禁', category: '规则', content: '亥时关城', pinned: true }, { kind: 'character', name: '沈默', role: '船工' }]
        }
      }
    })
    assert.equal(created.status, 200, created.text)
    const book = await row(sql`SELECT id, outline, chapter_words FROM cj_books WHERE title = '夜航' AND user_id = 1`)
    assert.equal(book.outline, '主线是返乡')
    assert.equal(book.chapter_words, 2500)
    const volume = await row(sql`SELECT title, goal FROM cj_volumes WHERE book_id = ${book.id}`)
    assert.equal(volume.title, '卷一')
    assert.equal(volume.goal, '离城')
    const chapter = await row(sql`SELECT number, title, goal FROM cj_chapters WHERE book_id = ${book.id}`)
    assert.equal(chapter.number, 1)
    assert.equal(chapter.goal, '动身')
    const setting = await row(sql`SELECT data FROM cj_cards WHERE book_id = ${book.id} AND name = '夜禁'`)
    assert.equal(JSON.parse(setting.data).pinned, true)
    assert.equal((await row(sql`SELECT book_id FROM cj_ai_chats WHERE id = ${chat.json.data.id}`)).book_id, book.id)
    const again = await call(`/api/changjuan/ai/chats/${chat.json.data.id}/create-book`, { method: 'POST', token, body: { message_id: messageId, suggestion_id: 's1', plan: { title: '夜航' } } })
    assert.equal(again.status, 409, again.text)
    const version = await row(sql`SELECT label, stats FROM cj_versions WHERE book_id = ${book.id}`)
    assert.equal(JSON.parse(version.stats).source, 'assist')
    assert.equal(version.label.includes('夜航'), true)
    const removed = await call(`/api/changjuan/books/${book.id}`, { method: 'DELETE', token })
    assert.equal(removed.status, 200, removed.text)
    assert.equal(await row(sql`SELECT id FROM cj_ai_chats WHERE id = ${chat.json.data.id}`), undefined)
    assert.equal(DEFAULT_OUTLINE.includes('总纲'), true)
  })

  test('两个人同时应用或建书时，自增 id 不会撞车', async () => {
    const bob = await harness.tokenFor(2)
    await harness.using(async () => {
      await db.run(sql`INSERT INTO cj_cards (id, user_id, book_id, kind, name, data) VALUES (9000, 1, 1, 'setting', '占位高号', '{}')`)
      await db.run(sql`INSERT INTO cj_books (id, user_id, title) VALUES (9000, 1, '占位高号书')`)
    })
    const suggestion = JSON.stringify([{
      id: 's1', target_type: 'card', target_id: 'new', status: 'pending',
      fields: { kind: 'character', name: '并发人物', role: '路人' }
    }])
    const chatA = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { book_id: 1, target_type: 'card', title: '安的新人物' } })
    const chatB = await call('/api/changjuan/ai/chats', { method: 'POST', token: bob, body: { book_id: 2, target_type: 'card', title: '鲍勃的新人物' } })
    const messageA = await harness.using(async () => Number((await db.run(sql`
      INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
      VALUES (${chatA.json.data.id}, 1, 'assistant', '可以', ${suggestion.replace('并发人物', '安的并发')})
    `)).lastInsertRowid))
    const messageB = await harness.using(async () => Number((await db.run(sql`
      INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
      VALUES (${chatB.json.data.id}, 2, 'assistant', '可以', ${suggestion.replace('并发人物', '鲍勃的并发')})
    `)).lastInsertRowid))
    const [appliedA, appliedB] = await Promise.all([
      call(`/api/changjuan/ai/chats/${chatA.json.data.id}/apply`, { method: 'POST', token, body: { message_id: messageA, ids: ['s1'] } }),
      call(`/api/changjuan/ai/chats/${chatB.json.data.id}/apply`, { method: 'POST', token: bob, body: { message_id: messageB, ids: ['s1'] } })
    ])
    assert.equal(appliedA.status, 200, appliedA.text)
    assert.equal(appliedB.status, 200, appliedB.text)
    assert.notEqual(appliedA.json.data.created.cards[0].id, appliedB.json.data.created.cards[0].id)
    const cardA = await row(sql`SELECT id, book_id FROM cj_cards WHERE name = '安的并发'`)
    const cardB = await row(sql`SELECT id, book_id FROM cj_cards WHERE name = '鲍勃的并发'`)
    assert.equal(cardA.book_id, 1)
    assert.equal(cardB.book_id, 2)
    assert.equal(cardA.id, appliedA.json.data.created.cards[0].id)
    const version = await row(sql`SELECT before_state FROM cj_versions WHERE book_id = 1 AND label LIKE 'AI 修改%' ORDER BY id DESC`)
    const before = JSON.parse(version.before_state)
    assert.equal(before.cards[String(cardA.id)], null)

    const bookSuggestion = (title) => JSON.stringify([{
      id: 's1', target_type: 'new_book', target_id: 'new', status: 'pending',
      fields: { title, volumes: [{ title: '卷一', goal: '出发', chapters: [{ title: '雨', goal: '上船' }] }], cards: [{ kind: 'character', name: title + '人', role: '主角' }] }
    }])
    const ideaA = await call('/api/changjuan/ai/chats', { method: 'POST', token, body: { target_type: 'new_book', title: '安的构思' } })
    const ideaB = await call('/api/changjuan/ai/chats', { method: 'POST', token: bob, body: { target_type: 'new_book', title: '鲍勃的构思' } })
    const ideaMessageA = await harness.using(async () => Number((await db.run(sql`
      INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
      VALUES (${ideaA.json.data.id}, 1, 'assistant', '建', ${bookSuggestion('安的新书')})
    `)).lastInsertRowid))
    const ideaMessageB = await harness.using(async () => Number((await db.run(sql`
      INSERT INTO cj_ai_messages (chat_id, user_id, role, content, suggestions)
      VALUES (${ideaB.json.data.id}, 2, 'assistant', '建', ${bookSuggestion('鲍勃的新书')})
    `)).lastInsertRowid))
    const [madeA, madeB] = await Promise.all([
      call(`/api/changjuan/ai/chats/${ideaA.json.data.id}/create-book`, { method: 'POST', token, body: { message_id: ideaMessageA, suggestion_id: 's1' } }),
      call(`/api/changjuan/ai/chats/${ideaB.json.data.id}/create-book`, { method: 'POST', token: bob, body: { message_id: ideaMessageB, suggestion_id: 's1' } })
    ])
    assert.equal(madeA.status, 200, madeA.text)
    assert.equal(madeB.status, 200, madeB.text)
    assert.notEqual(madeA.json.data.id, madeB.json.data.id)
    for (const made of [madeA, madeB]) {
      const bookId = made.json.data.id
      const volume = await row(sql`SELECT id, book_id FROM cj_volumes WHERE book_id = ${bookId} AND title = '卷一'`)
      const chapter = await row(sql`SELECT volume_id, goal FROM cj_chapters WHERE book_id = ${bookId}`)
      assert.equal(volume.book_id, bookId)
      assert.equal(chapter.volume_id, volume.id)
      assert.equal(chapter.goal, '上船')
      const stored = await row(sql`SELECT book_id, before_state FROM cj_versions WHERE book_id = ${bookId}`)
      const state = JSON.parse(stored.before_state)
      assert.equal(Object.prototype.hasOwnProperty.call(state.books, String(bookId)), true)
      assert.equal(state.books[String(bookId)], null)
    }
  })

  test('后面还有版本时，撤销提示不再只说章节确认', async () => {
    await harness.using(async () => {
      await db.run(sql`INSERT INTO cj_versions (user_id, book_id, chapter_id, chapter_number, label) VALUES (1, 1, 1, 1, '较早的一条')`)
      await db.run(sql`INSERT INTO cj_versions (user_id, book_id, chapter_id, chapter_number, label, stats) VALUES (1, 1, 0, 0, '更新的一条', '{"source":"assist"}')`)
    })
    const older = await row(sql`SELECT id FROM cj_versions WHERE book_id = 1 AND label = '较早的一条'`)
    const blocked = await call(`/api/changjuan/versions/${older.id}/revert`, { method: 'POST', token })
    assert.equal(blocked.status, 409, blocked.text)
    assert.equal(blocked.json.message, '后面还有还没撤销的版本，请先撤销最新的一条')
  })
})
