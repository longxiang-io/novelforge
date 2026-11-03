import { cjHandler, paramId } from '../../lib/common.js'
import { getVersion, versionDetail } from '../../lib/versions.js'

// GET /api/changjuan/versions/:id - 版本详情：按卡片分组的改动前后对比
export default cjHandler(async (event, auth) => ({ code: 200, data: (await versionDetail((await getVersion(auth.id, paramId(event))))) }))
