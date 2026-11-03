import { characterToText, foreshadowToText, settingToText, CHARACTER_STATE_FIELDS } from './memory.js'

// 长卷所有模型提示词集中在这里，改检查提示词后请同步提高 CHECK_PROMPT_VERSION，并到"统计"页跑一遍测试集
export const CHECK_PROMPT_VERSION = '检查提示词 v1'

const outlineBlock = (chapter) => [
  `第 ${chapter.number} 章《${chapter.title || '未命名'}》细纲：`,
  chapter.goal && `- 本章目标：${chapter.goal}`,
  chapter.conflict && `- 冲突：${chapter.conflict}`,
  chapter.payoff && `- 爽点：${chapter.payoff}`,
  chapter.hook && `- 章末钩子：${chapter.hook}`
].filter(Boolean).join('\n')

export const contextBlock = (context) => {
  const parts = []
  if (context.volume) parts.push(`【本卷目标】${context.volume.title}：${context.volume.goal || '（未填写）'}`)
  if (context.characters.length) parts.push(`【相关人物卡】\n${context.characters.map(characterToText).join('\n\n')}`)
  if (context.settings.length) parts.push(`【相关设定】\n${context.settings.map(settingToText).join('\n')}`)
  if (context.foreshadows.length) parts.push(`【未回收的伏笔】\n${context.foreshadows.map(foreshadowToText).join('\n')}`)
  if (context.summaries.length) parts.push(`【前情摘要】\n${context.summaries.map(item => `第 ${item.number} 章《${item.title}》：${item.summary}`).join('\n')}`)
  return parts.join('\n\n')
}

const WRITER_SYSTEM = [
  '你是一名经验丰富的中文网络小说作者，正在和作者合作连载长篇。',
  '写作要求：',
  '1. 严格遵守记忆库里的人物设定、当前状态和世界设定，不要让已死亡或已离场的人物出场，不要让境界倒退或无故跃升。',
  '2. 按细纲推进剧情，写出冲突和爽点，结尾留下钩子。',
  '3. 文风干净利落，少用形容词堆砌和排比，避免"仿佛""宛如""不禁"之类的套话，对话推动剧情。',
  '4. 只输出正文，不要输出标题、章节号、说明或 Markdown 标记。每段一行，段与段之间换行。'
].join('\n')

export const buildGenerateMessages = ({ book, chapter, context, worldText }) => {
  const words = chapter.target_words || book.chapter_words || 2500
  return [
    { role: 'system', content: WRITER_SYSTEM },
    {
      role: 'user',
      content: [
        worldText ? `【世界观】\n${worldText.slice(0, 4000)}` : '',
        contextBlock(context),
        outlineBlock(chapter),
        `请写出本章正文，约 ${words} 字。`
      ].filter(Boolean).join('\n\n')
    }
  ]
}

export const buildContinueMessages = ({ book, chapter, context, existing }) => {
  const words = chapter.target_words || book.chapter_words || 2500
  return [
    { role: 'system', content: WRITER_SYSTEM },
    {
      role: 'user',
      content: [
        contextBlock(context),
        outlineBlock(chapter),
        `本章已经写好的部分如下（约 ${existing.replace(/\s/g, '').length} 字）：\n${existing.slice(-6000)}`,
        `请紧接着最后一句往下写，不要重复已有内容，全章总共约 ${words} 字。只输出新写的部分。`
      ].join('\n\n')
    }
  ]
}

const CHECK_SYSTEM = [
  '你是长篇小说的一致性审校。对照"记忆库事实"检查正文，只找真正的矛盾，不评价文笔。',
  '检查项：人物言行是否符合人设；是否与已有设定冲突（时间线、境界、地点、规则）；已死亡或已离场的人物是否误出场；口头禅等重复是否过多。',
  '严重程度：must = 必须改（硬性矛盾，如死人出场、境界不符、时间线错乱）；should = 建议改（人设偏差、可疑之处）；hint = 仅提示（重复、小瑕疵）。',
  '只输出 JSON，不要解释，格式：{"issues":[{"severity":"must|should|hint","title":"问题简述（10 字内）","paragraph":段号数字,"quote":"原文中的句子，必须逐字摘录","basis":"依据：引用记忆库中的事实","card":"相关人物或设定名"}]}',
  '没有问题时输出 {"issues":[]}。'
].join('\n')

export const buildCheckMessages = ({ facts, paragraphs, falsePositives = [] }) => {
  const fpBlock = falsePositives.length
    ? `【作者此前标为误报的问题，类似情况不要再报】\n${falsePositives.map(item => `- ${item.title}：${item.quote}${item.fp_reason ? `（原因：${item.fp_reason}${item.fp_note ? `，${item.fp_note}` : ''}）` : ''}`).join('\n')}`
    : ''
  return [
    { role: 'system', content: CHECK_SYSTEM },
    {
      role: 'user',
      content: [
        `【记忆库事实】\n${facts || '（暂无）'}`,
        fpBlock,
        `【正文，已按段编号】\n${paragraphs.map((text, index) => `[${index + 1}] ${text}`).join('\n')}`
      ].filter(Boolean).join('\n\n')
    }
  ]
}

const STATE_KEYS = CHARACTER_STATE_FIELDS.filter(([key]) => key !== 'last_seen').map(([key, label]) => `${key}(${label})`).join('、')

const EXTRACT_SYSTEM = [
  '你负责在每章写完后，从正文中提取需要写进故事记忆库的改动。只提取本章正文里明确发生的事，不要推测。',
  `人物状态字段只能用：${STATE_KEYS}，关系用 "relation:对方名字"。`,
  '只输出 JSON，格式：',
  '{"state_changes":[{"character":"人物名","field":"字段","new":"新值","quote":"原文依据句","paragraph":段号}],',
  '"new_characters":[{"name":"新人物名","role":"身份","appearance":"","personality":"","quote":""}],',
  '"new_settings":[{"name":"设定名","category":"地点|势力|物品|规则|时间线|境界|其他","content":"设定内容","quote":""}],',
  '"new_foreshadows":[{"content":"伏笔内容","characters":["相关人物"],"planned_chapter":计划回收章号或null,"quote":""}],',
  '"resolved_foreshadows":[{"code":"伏笔编号","quote":""}]}',
  '没有的项输出空数组。'
].join('\n')

export const buildExtractMessages = ({ chapter, characters, settings, foreshadows, paragraphs }) => [
  { role: 'system', content: EXTRACT_SYSTEM },
  {
    role: 'user',
    content: [
      `【现有人物卡】\n${characters.map(characterToText).join('\n\n') || '（暂无）'}`,
      `【现有设定】\n${settings.map(settingToText).join('\n') || '（暂无）'}`,
      `【未回收伏笔】\n${foreshadows.map(foreshadowToText).join('\n') || '（暂无）'}`,
      `【第 ${chapter.number} 章正文，已按段编号】\n${paragraphs.map((text, index) => `[${index + 1}] ${text}`).join('\n')}`
    ].join('\n\n')
  }
]

export const buildSummaryMessages = ({ chapter, content }) => [
  { role: 'system', content: '你为长篇小说写章节摘要，供后续章节当作前情提要。用 150 到 300 字概括本章发生的关键事件、人物状态变化和留下的悬念，只输出摘要正文。' },
  { role: 'user', content: `第 ${chapter.number} 章《${chapter.title}》正文：\n${content.slice(0, 12000)}` }
]

export const buildPingMessages = () => [{ role: 'user', content: '只回复：好' }]

const ASSIST_SYSTEM = [
  '你是长篇小说的创作搭档，帮作者讨论并填写大纲、细纲、人物卡和设定卡。',
  '可以自由讨论、追问和出主意。信息不够时先问关键问题，不要编一套和作者已经说过的意图相反的设定。',
  '新书构思从题材、卖点、主角、世界观、金手指、核心冲突和开篇聊起。作者只给了一个模糊点子时，先追问，不要立刻铺开一整套方案。',
  '你不能直接改书。要改内容时，先用普通中文说明，再在回复的最后单独给出修改建议。',
  '修改建议必须是回复的最后一部分，两行标记各自单独成行，中间只放 JSON，不要用 Markdown 代码围栏：',
  '<<<cj-suggestions>>>',
  '{"suggestions":[{"target_type":"chapter","target_id":"当前对象可省略","fields":{"goal":"新的目标"}}]}',
  '<<<end>>>',
  '没有要改的内容时不要输出这块标记。',
  'target_type 只能是 book、volume、chapter、card、new_book。',
  '改当前正在聊的对象时可以省略 target_id。新建分卷、章节或卡片时 target_id 写 "new"。',
  'book 的 fields：title、chapter_words、foreshadow_remind、world、outline。',
  'volume 的 fields：title、goal、outline。',
  'chapter 的 fields：number、title、goal、conflict、payoff、hook、characters、foreshadows、target_words、volume_id。不要写正文，不要写 content。',
  'card 的 fields：kind 为 character 或 setting，以及 name。人物可写 role、appearance、personality、catchphrase、arc、alive、present。设定可写 category（地点、势力、物品、规则、时间线、境界、其他）、content、pinned。pinned 为 true 表示建议每章都带上，规则类设定可以这样标。',
  'new_book 只用于还没有书的构思。fields 可含 title、chapter_words、world、outline、volumes、cards。每卷有 title、goal、outline、chapters，章节用细纲字段。可以只给书名、简介或总纲。',
  '一次可以给多条建议，例如补全多章细纲，或新建几张人物卡。',
  '数字范围：每章字数和目标字数 300 到 20000，伏笔提醒 0 到 50。',
  '讨论已写章节时只用细纲和摘要，不要复述正文。'
].join('\n')

export const buildAssistMessages = ({ contextText, targetLabel, history, userText }) => {
  const messages = [{
    role: 'system',
    content: `${ASSIST_SYSTEM}\n\n正在聊的对象：${targetLabel || '未指定'}\n\n${contextText || ''}`
  }]
  for (const item of (history || []).slice(-16)) {
    if (item?.role !== 'user' && item?.role !== 'assistant') continue
    const content = String(item.content || '').trim().slice(0, 4000)
    if (!content) continue
    messages.push({ role: item.role, content })
  }
  messages.push({ role: 'user', content: String(userText || '').slice(0, 8000) })
  return messages
}
