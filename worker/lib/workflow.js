import { chatCompletion } from './llm.js'
import { buildSummaryMessages } from './prompts.js'

// 章节摘要：确认后自动生成，作为后续章节的前情摘要
export const generateSummary = async (userId, chapter) => {
  const result = await chatCompletion({
    task: 'summary',
    messages: buildSummaryMessages({ chapter, content: chapter.content }),
    userId,
    bookId: chapter.book_id,
    chapterId: chapter.id,
    maxTokens: 800,
    temperature: 0.2
  })
  return result.text.trim().slice(0, 2000)
}
