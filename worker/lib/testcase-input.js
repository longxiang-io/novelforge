import { CjError } from './common.js'

// expected: [{ label: '死人出场', keyword: '赵乾' }]，检查结果的引用/标题/依据里出现 keyword 即算抓到
export const readTestcaseInput = (body) => {
  const title = String(body.title || '').trim().slice(0, 60)
  const content = String(body.content || '').replace(/\r\n?/g, '\n').trim().slice(0, 20000)
  const context = String(body.context || '').replace(/\r\n?/g, '\n').trim().slice(0, 10000)
  const expected = (Array.isArray(body.expected) ? body.expected : [])
    .map(item => ({ label: String(item?.label || '').trim().slice(0, 60), keyword: String(item?.keyword || '').trim().slice(0, 40) }))
    .filter(item => item.keyword)
    .slice(0, 20)
  if (!title || !content) throw new CjError(400, '请填写标题和正文')
  if (!expected.length) throw new CjError(400, '至少填写一处埋下的错误（含关键词）')
  return { title, content, context, expected }
}
