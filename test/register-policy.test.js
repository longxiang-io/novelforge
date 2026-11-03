import test from 'node:test'
import assert from 'node:assert/strict'
import { registrationOpen } from '../worker/lib/register-policy.js'

test('empty database always allows the first admin', () => {
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: 'false' }, 0), true)
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: 'true' }, 0), true)
  assert.equal(registrationOpen({}, 0), true)
})

test('later sign-ups follow ALLOW_REGISTRATION', () => {
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: 'false' }, 1), false)
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: '0' }, 1), false)
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: 'off' }, 1), false)
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: 'no' }, 1), false)
  assert.equal(registrationOpen({ ALLOW_REGISTRATION: 'true' }, 1), true)
  assert.equal(registrationOpen({}, 2), true)
})
