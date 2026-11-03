import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNdjsonParser, encodeNdjson } from '../shared/ndjson.js'

test('跨块拼接 NDJSON，忽略空行，并收下最后一行', () => {
  const seen = []
  const parser = createNdjsonParser(event => seen.push(event))
  const firstLine = encodeNdjson({ type: 'context', data: { n: 1 } })
  const raw = `${firstLine}\n${encodeNdjson({ type: 'delta', text: '甲' })}`
  const cut = Math.floor(firstLine.length / 2)
  assert.deepEqual(parser.push(raw.slice(0, cut)), [])
  const first = parser.push(raw.slice(cut))
  assert.equal(first.length, 2)
  assert.deepEqual(parser.flush(), [])
  const tail = encodeNdjson({ type: 'done', saved: true }).replace(/\n$/, '')
  parser.push(tail.slice(0, 4))
  parser.push(tail.slice(4))
  assert.deepEqual(parser.flush(), [{ type: 'done', saved: true }])
  assert.deepEqual(seen.map(item => item.type), ['context', 'delta', 'done'])
})
