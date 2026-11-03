import { Hono } from 'hono'
import { runWithEnv } from './env.js'
import { createDb, runWithDbInstance } from './db.js'
import { authRoutes, requireUser } from './auth.js'
import { registerChangjuan } from './routes.js'
import { internalError } from './lib/common.js'

const app = new Hono()

app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (path === '/api/changjuan' || path.startsWith('/api/changjuan/')) return requireUser(c, next)
  await next()
})

app.route('/api/auth', authRoutes)
registerChangjuan(app)
app.all('/api/*', (c) => c.json({ code: 404, message: '接口不存在' }, 404))

app.onError((err, c) => internalError(c, err, '未处理异常'))

export default {
  async fetch(request, env, ctx) {
    if (!env?.DB) return Response.json({ code: 500, message: '未绑定 D1 数据库' }, { status: 500 })
    return runWithEnv(env, () => runWithDbInstance(createDb(env.DB), () => app.fetch(request, env, ctx)))
  }
}
