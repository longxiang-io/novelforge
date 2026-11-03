import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/d1'

const dbAls = new AsyncLocalStorage()

const normalizeRun = (result) => {
  const meta = result?.meta || {}
  return {
    changes: meta.changes ?? result?.changes ?? 0,
    lastInsertRowid: meta.last_row_id ?? meta.lastInsertRowid ?? result?.lastInsertRowid ?? 0
  }
}

export const createDb = (d1) => {
  const orm = drizzle(d1)
  const db = {
    get: (query) => orm.get(query),
    all: (query) => orm.all(query),
    run: async (query) => normalizeRun(await orm.run(query)),
    // D1 的 batch 一次提交，任一语句失败则整批回滚。
    // drizzle 的 raw run 没有 stmt，参数化语句要自己 prepare 才能放进 batch。
    batch: async (queries) => {
      if (!queries?.length) return []
      const runnable = queries.map((query) => {
        const raw = orm.run(query)
        const built = raw.getQuery()
        raw.stmt = d1.prepare(built.sql)
        return raw
      })
      return (await orm.batch(runnable)).map(normalizeRun)
    }
  }
  return db
}

export const runWithDbInstance = (db, fn) => dbAls.run(db, fn)

export const getDb = () => {
  const db = dbAls.getStore()
  if (!db) throw new Error('数据库未初始化')
  return db
}

// 业务代码里的 db.get / db.run 都走当前请求的连接。
export const db = {
  get: (query) => getDb().get(query),
  all: (query) => getDb().all(query),
  run: (query) => getDb().run(query),
  batch: (queries) => getDb().batch(queries)
}
