import { cjHandler } from '../../lib/common.js'
import { publicConfig } from '../../lib/config.js'

// GET /api/changjuan/config - 当前用户自己的模型与密钥（密钥打码；本机密钥不在服务器上）
export default cjHandler(async (event, auth) => ({ code: 200, data: (await publicConfig(auth.id)) }))
