import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, CjError, getBook, paramId, queryOf, toInt } from '../../../lib/common.js'
import { chapterHeading, chapterToTxt, contentDisposition } from '../../../lib/export.js'
import { createZip } from '../../../lib/zip.js'

// GET /api/changjuan/books/:id/export-txt?from=&to=&merge=1 - 导出已确认章节的 TXT（单章或合并为一个文件；多章分文件时打包 zip）
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const query = queryOf(event)
  const from = toInt(query.from, 1)
  const to = toInt(query.to, from)
  if (to < from) throw new CjError(400, '章节范围不正确')
  const chapters = (await db.all(sql`
    SELECT number, title, content FROM cj_chapters
    WHERE book_id = ${book.id} AND user_id = ${auth.id} AND status = 'confirmed' AND number BETWEEN ${from} AND ${to}
    ORDER BY number
  `))
  if (!chapters.length) throw new CjError(400, '范围内没有已确认的章节（只能导出已确认的章节）')
  const merge = query.merge === '1' || query.merge === 'true'
  if (merge || chapters.length === 1) {
    const text = chapters.map(chapterToTxt).join('\n\n')
    const name = chapters.length === 1 ? `${chapterHeading(chapters[0])}.txt` : `${book.title} 第${from}-${to}章.txt`
    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': contentDisposition(name, 'chapter.txt'), 'Cache-Control': 'no-store' }
    })
  }
  const zip = createZip(chapters.map(chapter => ({ name: `${chapterHeading(chapter).replace(/[\\/:*?"<>|]/g, '_')}.txt`, content: chapterToTxt(chapter) })))
  return new Response(zip, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': contentDisposition(`${book.title} 第${from}-${to}章.zip`, 'chapters.zip'), 'Cache-Control': 'no-store' }
  })
})
