import { AsyncLocalStorage } from 'node:async_hooks'

const envAls = new AsyncLocalStorage()

export const runWithEnv = (env, fn) => envAls.run(env, fn)

export const getEnv = () => envAls.getStore() || {}
