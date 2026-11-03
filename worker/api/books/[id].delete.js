import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, getBook, paramId } from '../../lib/common.js'

const BOOK_TABLES = ['cj_issues', 'cj_changes', 'cj_versions', 'cj_usage', 'cj_foreshadows', 'cj_cards', 'cj_chapters', 'cj_volumes']

// DELETE /api/changjuan/books/:id - 删除整本书及其全部章节、记忆库、版本和挂在这本书上的对话
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  ;(await db.batch([
    sql`
      DELETE FROM cj_ai_messages WHERE user_id = ${auth.id} AND chat_id IN (
        SELECT id FROM cj_ai_chats WHERE book_id = ${book.id} AND user_id = ${auth.id}
      )
    `,
    sql`DELETE FROM cj_ai_chats WHERE book_id = ${book.id} AND user_id = ${auth.id}`,
    ...BOOK_TABLES.map(table => sql`DELETE FROM ${sql.identifier(table)} WHERE book_id = ${book.id} AND user_id = ${auth.id}`),
    sql`DELETE FROM cj_books WHERE id = ${book.id} AND user_id = ${auth.id}`
  ]))
  return { code: 200, message: '已删除' }
})
