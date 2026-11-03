import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, CjError, cleanText, getBook, getChapter, paramId, readBody, touchBook } from '../../lib/common.js'
import { readOutlineFields } from '../../lib/chapter-fields.js'

// PUT /api/changjuan/chapters/:id - 保存细纲或正文。正文改动后需要重新检查；已确认的章节要先撤销确认才能改正文
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  const book = (await getBook(auth.id, chapter.book_id))
  const body = await readBody(event)
  const next = (await readOutlineFields(body, chapter, book))
  let content = chapter.content
  let dirty = chapter.check_dirty
  if (body.content !== undefined) {
    const value = cleanText(body.content, 200000)
    if (value !== chapter.content) {
      if (chapter.status === 'confirmed') throw new CjError(409, '本章已确认，要改正文请先在版本历史里撤销本章确认')
      content = value
      dirty = 1
    }
  }
  ;(await db.run(sql`
    UPDATE cj_chapters SET volume_id = ${next.volume_id}, number = ${next.number}, title = ${next.title || chapter.title},
      goal = ${next.goal}, conflict = ${next.conflict}, payoff = ${next.payoff}, hook = ${next.hook},
      characters = ${next.characters}, foreshadows = ${next.foreshadows}, target_words = ${next.target_words},
      content = ${content}, check_dirty = ${dirty}, updated_at = datetime('now', '+8 hours')
    WHERE id = ${chapter.id} AND user_id = ${auth.id}
  `))
  ;(await touchBook(book.id, auth.id))
  return { code: 200, message: '已保存', data: { check_dirty: dirty } }
})
