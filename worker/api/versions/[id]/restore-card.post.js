import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, paramId, readBody, toInt } from '../../../lib/common.js'
import { restoreCardStatementFor } from '../../../lib/memory.js'
import { getVersion } from '../../../lib/versions.js'

// POST /api/changjuan/versions/:id/restore-card - 只把一张卡还原到这次确认之前
export default cjHandler(async (event, auth) => {
  const version = (await getVersion(auth.id, paramId(event)))
  if (version.reverted) throw new CjError(409, '这个版本已经撤销过了')
  const body = await readBody(event)
  const cardId = toInt(body.card_id, 0)
  const statement = restoreCardStatementFor(auth.id, version, cardId)
  if (!statement) throw new CjError(400, '这次确认没有改动这张卡')
  ;(await db.batch([
    statement,
    sql`UPDATE cj_books SET updated_at = datetime('now', '+8 hours') WHERE id = ${version.book_id} AND user_id = ${auth.id}`
  ]))
  return { code: 200, message: '已还原这张卡' }
})
