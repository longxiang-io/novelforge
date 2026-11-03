import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler, readBody } from '../../lib/common.js'

// 示例埋错章节：死人出场、境界倒退、时间线对不上
const SAMPLES = [
  {
    title: '示例 001 · 死人出场',
    context: '人物：赵乾，存活：否（第 9 章被林风所杀）。林风，境界：炼气七层。',
    content: '夜色压在藏经阁的飞檐上。林风贴着墙根挪到侧窗下。\n赵乾冷笑一声，挡在了阁门前。\n林风握紧了残剑。',
    expected: [{ label: '已死亡角色出场', keyword: '赵乾' }]
  },
  {
    title: '示例 002 · 境界倒退',
    context: '人物：林风，境界：筑基初期（第 20 章突破）。',
    content: '林风深吸一口气，以炼气七层的修为强行催动剑诀。\n剑光一闪，对面的弟子连退三步。',
    expected: [{ label: '境界倒退', keyword: '炼气七层' }]
  },
  {
    title: '示例 003 · 时间线对不上',
    context: '时间线：宗门大比在入门后第 3 天举行。林风入门当天遇到苏晚晴。',
    content: '入门第五天，宗门大比如期开始。\n苏晚晴站在看台上，朝林风点了点头。\n林风想起三天前入门那天，正是她替自己解了围。',
    expected: [{ label: '时间线错误', keyword: '第五天' }]
  }
]

// 英文界面用的示例，题材换成西式奇幻，埋的错误类型与中文示例一一对应
const SAMPLES_EN = [
  {
    title: 'Sample 001 · A dead character appears',
    context: 'Character: Marcus Thorne, alive: no (killed by Rowan Hale in chapter 9). Rowan Hale, power level: Apprentice, seventh circle.',
    content: 'Night pressed down on the library roof. Rowan crept along the wall to the side window.\nMarcus Thorne laughed coldly and stepped in front of the door.\nRowan tightened his grip on the broken sword.',
    expected: [{ label: 'A dead character appears', keyword: 'Marcus Thorne' }]
  },
  {
    title: 'Sample 002 · Power level goes backwards',
    context: 'Character: Rowan Hale, power level: Adept, first circle (reached in chapter 20).',
    content: 'Rowan took a deep breath and forced the spell out with the strength of an Apprentice of the seventh circle.\nLight flashed, and the student facing him staggered back three steps.',
    expected: [{ label: 'Power level goes backwards', keyword: 'Apprentice of the seventh circle' }]
  },
  {
    title: 'Sample 003 · Timeline mismatch',
    context: 'Timeline: the Proving is held on the 3rd day after enrollment. Rowan meets Elara Vance on the day he enrolls.',
    content: 'On the fifth day after enrollment, the Proving began as planned.\nElara Vance stood in the stands and nodded at Rowan.\nRowan remembered the day he enrolled, three days ago, when she had stepped in to help him.',
    expected: [{ label: 'Timeline mismatch', keyword: 'fifth day' }]
  }
]

// POST /api/changjuan/testcases/seed - 插入示例测试集（已存在同名用例则跳过）
export default cjHandler(async (event, auth) => {
  const body = await readBody(event).catch(() => ({}))
  const samples = /^en/i.test(String((body && body.locale) || '')) ? SAMPLES_EN : SAMPLES
  let added = 0
  for (const sample of samples) {
    if ((await db.get(sql`SELECT id FROM cj_testcases WHERE user_id = ${auth.id} AND title = ${sample.title}`))) continue
    ;(await db.run(sql`INSERT INTO cj_testcases (user_id, title, context, content, expected) VALUES (${auth.id}, ${sample.title}, ${sample.context}, ${sample.content}, ${JSON.stringify(sample.expected)})`))
    added++
  }
  return { code: 200, added, message: added ? `已添加 ${added} 个示例` : '示例已存在' }
})
