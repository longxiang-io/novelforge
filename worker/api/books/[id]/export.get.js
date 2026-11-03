import { cjHandler, getBook, paramId } from '../../../lib/common.js'
import { buildBookArchive, contentDisposition } from '../../../lib/export.js'
import { createZip } from '../../../lib/zip.js'

// GET /api/changjuan/books/:id/export - 导出整本书（zip：正文 Markdown + 大纲/记忆库/伏笔/摘要 YAML）
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const { root, files } = (await buildBookArchive(book))
  const zip = createZip(files)
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(`${root}-整本备份.zip`, 'changjuan-book.zip'),
      'Cache-Control': 'no-store'
    }
  })
})
