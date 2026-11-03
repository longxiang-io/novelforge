import { sql } from 'drizzle-orm'
import { db } from '../../db.js'
import { cjHandler } from '../../lib/common.js'

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

// POST /api/changjuan/testcases/seed - 插入示例测试集（已存在同名用例则跳过）
export default cjHandler(async (event, auth) => {
  let added = 0
  for (const sample of SAMPLES) {
    if ((await db.get(sql`SELECT id FROM cj_testcases WHERE user_id = ${auth.id} AND title = ${sample.title}`))) continue
    ;(await db.run(sql`INSERT INTO cj_testcases (user_id, title, context, content, expected) VALUES (${auth.id}, ${sample.title}, ${sample.context}, ${sample.content}, ${JSON.stringify(sample.expected)})`))
    added++
  }
  return { code: 200, message: added ? `已添加 ${added} 个示例` : '示例已存在' }
})
