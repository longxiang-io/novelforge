import { cjHandler, getBook, getChapter, paramId } from '../../../lib/common.js'
import { buildContext, contextSummary } from '../../../lib/memory.js'

// GET /api/changjuan/chapters/:id/context - 预览本章生成时会注入的上下文（含漏召回提醒）
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  const book = (await getBook(auth.id, chapter.book_id))
  return { code: 200, data: contextSummary((await buildContext(book, chapter))) }
})
