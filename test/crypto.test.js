import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decryptString, encryptString } from '../worker/lib/crypto.js'

const key = 'test-encryption-key-0123456789'

test('加密后再解密得到原文', async () => {
  const stored = await encryptString('sk-example-key', key)
  assert.match(stored, /^enc:v1:/)
  assert.equal(await decryptString(stored, key), 'sk-example-key')
})

test('空字符串不加密', async () => {
  assert.equal(await encryptString('', key), '')
  assert.equal(await decryptString('', key), '')
})

test('密钥不对时解密失败', async () => {
  const stored = await encryptString('secret-value', key)
  await assert.rejects(() => decryptString(stored, 'another-key-that-is-different'), /无法解密/)
})
