import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armDisconnectBudget, guardSend, keepAfterResponse, runGenerateSession } from '../worker/lib/generate-session.js'

const countWords = (text) => String(text || '').replace(/\s+/g, '').length

const session = (overrides) => runGenerateSession({
  mode: 'full',
  existingContent: '',
  chapterNumber: 2,
  injected: { characters: [] },
  countWords,
  send() {},
  async save() {},
  async streamCompletion() {
    return { text: '', usage: { prompt_tokens: 1 }, model: 'm', cost: 0 }
  },
  ...overrides
})

test('客户端写失败不会打断读取，全文仍会保存', async () => {
  const seen = []
  let saved = null
  const result = await session({
    send(payload) {
      seen.push(payload.type)
      if (payload.type === 'delta') throw new Error('client gone')
    },
    async streamCompletion({ onDelta, onReasoning }) {
      onReasoning('想')
      onDelta('第一段')
      onDelta('第二段')
      return { text: '第一段第二段', usage: { prompt_tokens: 4 }, model: 'demo', cost: 0.1 }
    },
    async save(info) { saved = info }
  })
  assert.equal(result.saved, true)
  assert.equal(saved.content, '第一段第二段')
  assert.equal(saved.promptTokens, 4)
  assert.equal(saved.model, 'demo')
  assert.deepEqual(seen, ['context', 'reasoning', 'delta'])
})

test('模型报错但已有正文时存成草稿', async () => {
  const events = []
  let saved = null
  const result = await session({
    send(payload) { events.push(payload) },
    async streamCompletion({ onDelta }) {
      onDelta('半截')
      return {
        text: '半截',
        usage: { prompt_tokens: 2 },
        model: 'demo',
        cost: null,
        error: { message: '网络中断', extra: { error_type: 'network' } }
      }
    },
    async save(info) { saved = info }
  })
  assert.equal(result.saved, true)
  assert.equal(saved.content, '半截')
  const error = events.find(item => item.type === 'error')
  assert.equal(error.saved, true)
  assert.equal(error.error_type, 'network')
  assert.match(error.detail, /已保存为草稿/)
})

test('读取中途抛错时，已写出的部分仍保存', async () => {
  let saved = null
  const result = await session({
    mode: 'continue',
    existingContent: '旧文',
    async streamCompletion({ onDelta }) {
      onDelta('续写')
      throw Object.assign(new Error('上游断开'), { extra: { error_type: 'upstream' } })
    },
    async save(info) { saved = info }
  })
  assert.equal(result.saved, true)
  assert.equal(result.piece, '续写')
  assert.equal(saved.content, '旧文\n续写')
})

test('没有正文时不写库', async () => {
  let calls = 0
  const events = []
  const result = await session({
    send(payload) { events.push(payload) },
    async streamCompletion() {
      return { text: '  ', error: { message: '模型没有返回正文', extra: { error_type: 'empty' } } }
    },
    async save() { calls += 1 }
  })
  assert.equal(result.saved, false)
  assert.equal(calls, 0)
  assert.equal(events.at(-1).saved, false)
  assert.match(events.at(-1).detail, /没有写入任何内容/)
})

test('时限到了就中止，并保存已经拿到的正文', async () => {
  const abort = new AbortController()
  const budget = armDisconnectBudget(abort, 30)
  let saved = null
  const pending = session({
    signal: abort.signal,
    async streamCompletion({ signal, onDelta }) {
      onDelta('已写')
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ text: '已写完', usage: { prompt_tokens: 1 }, model: 'm' }), 500)
        const finish = () => {
          clearTimeout(timer)
          resolve({ text: '已写', aborted: true, usage: { prompt_tokens: 1 }, model: 'm' })
        }
        if (signal?.aborted) finish()
        else signal?.addEventListener('abort', finish, { once: true })
      })
    },
    async save(info) { saved = info }
  })
  budget.arm()
  const result = await pending
  budget.clear()
  assert.equal(abort.signal.aborted, true)
  assert.equal(result.saved, true)
  assert.equal(saved.content, '已写')
})

test('waitUntil 接到同一个任务', async () => {
  let hooked = null
  const task = Promise.resolve('done')
  assert.equal(keepAfterResponse({ waitUntil(value) { hooked = value } }, task), task)
  assert.equal(hooked, task)
  assert.equal(keepAfterResponse(undefined, task), task)
})

test('写流的拒绝被吞掉', async () => {
  const send = guardSend(() => Promise.reject(new Error('closed')))
  send({ type: 'delta' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.doesNotThrow(() => send({ type: 'done' }))
})
