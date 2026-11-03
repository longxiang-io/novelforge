import { cjHandler } from '../../lib/common.js'
import { describeAssistModel } from '../../lib/llm.js'

// GET /api/changjuan/ai/model - 面板用来决定要不要提示「暂时使用生成正文的模型」。没配好也返回 200。
export default cjHandler(async (_event, auth) => {
  const info = await describeAssistModel(auth.id)
  return {
    code: 200,
    data: { ready: info.ready, fallback: info.fallback, source: info.source, model: info.model }
  }
})
