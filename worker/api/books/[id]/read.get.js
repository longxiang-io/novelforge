import { sql } from 'drizzle-orm'
import { db } from '../../../db.js'
import { cjHandler, countWords, getBook, paramId, queryOf, toInt } from '../../../lib/common.js'

// GET /api/changjuan/books/:id/read?volume= - 某一卷里已确认的章节，给预览用
export default cjHandler(async (event, auth) => {
  const book = (await getBook(auth.id, paramId(event)))
  const volumes = (await db.all(sql`SELECT id, title, sort FROM cj_volumes WHERE book_id = ${book.id} AND user_id = ${auth.id} ORDER BY sort, id`))
  const chapters = (await db.all(sql`
    SELECT id, volume_id, number, title, content FROM cj_chapters
    WHERE book_id = ${book.id} AND user_id = ${auth.id} AND status = 'confirmed'
    ORDER BY number
  `))
  const known = new Set(volumes.map(item => item.id))
  const groups = volumes.map(volume => ({
    id: volume.id,
    title: volume.title,
    confirmed: chapters.filter(item => item.volume_id === volume.id).length
  }))
  const loose = chapters.filter(item => !known.has(item.volume_id))
  if (loose.length) groups.push({ id: 0, title: '未分卷', confirmed: loose.length })
  const visible = groups.filter(item => item.confirmed > 0)
  const requested = toInt(queryOf(event).volume, null)
  const selected = visible.find(item => item.id === requested) || visible[0] || null
  const rows = selected
    ? chapters.filter(item => (selected.id === 0 ? !known.has(item.volume_id) : item.volume_id === selected.id))
    : []
  return {
    code: 200,
    data: {
      volumes: visible,
      volume_id: selected ? selected.id : null,
      chapters: rows.map(item => ({
        id: item.id,
        number: item.number,
        title: item.title,
        content: item.content,
        word_count: countWords(item.content)
      }))
    }
  }
})
