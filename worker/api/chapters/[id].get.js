import { cjHandler, getChapter, paramId } from '../../lib/common.js'
import { chapterDetail } from '../../lib/views.js'

// GET /api/changjuan/chapters/:id - 章节详情：细纲、正文、当前检查问题、待确认改动、费用
export default cjHandler(async (event, auth) => {
  const chapter = (await getChapter(auth.id, paramId(event)))
  return { code: 200, data: (await chapterDetail(chapter)) }
})
