import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, getBook, queryOf } from '../../../lib/common.js'
import { ASSIST_TARGET_TYPES } from '../../../lib/assist-schema.js'

// GET /api/changjuan/ai/chats?target_type=&book_id=&target_id=
// 新书构思不传 book_id。卡片还没保存时不传 target_id，只列出这条对象上的空目标对话。
export default cjHandler(async (event, auth) => {
  const query = queryOf(event)
  const targetType = String(query.target_type || '')
  if (!ASSIST_TARGET_TYPES.includes(targetType)) throw new CjError(400, '对话对象不正确')
  let rows
  if (targetType === 'new_book') {
    rows = await db.all(sql`
      SELECT id, book_id, target_type, target_id, title, created_at, updated_at
      FROM cj_ai_chats WHERE user_id = ${auth.id} AND target_type = 'new_book'
      ORDER BY updated_at DESC, id DESC LIMIT 100
    `)
  } else {
    const book = await getBook(auth.id, Number(query.book_id) || 0)
    const rawTarget = query.target_id
    const targetId = rawTarget === undefined || rawTarget === '' ? null : Number(rawTarget)
    if (targetType === 'book' || targetId) {
      const id = targetType === 'book' ? book.id : targetId
      rows = await db.all(sql`
        SELECT id, book_id, target_type, target_id, title, created_at, updated_at
        FROM cj_ai_chats
        WHERE user_id = ${auth.id} AND book_id = ${book.id} AND target_type = ${targetType} AND target_id = ${id}
        ORDER BY updated_at DESC, id DESC LIMIT 100
      `)
    } else {
      rows = await db.all(sql`
        SELECT id, book_id, target_type, target_id, title, created_at, updated_at
        FROM cj_ai_chats
        WHERE user_id = ${auth.id} AND book_id = ${book.id} AND target_type = ${targetType} AND target_id IS NULL
        ORDER BY updated_at DESC, id DESC LIMIT 100
      `)
    }
  }
  return { code: 200, data: rows }
})
