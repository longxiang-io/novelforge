// 预设头像。key 存在 users.avatar，空着表示用用户名首字母。
export const AVATARS = [
  { key: 'pen', label: '笔' },
  { key: 'book', label: '书' },
  { key: 'ink', label: '墨滴' },
  { key: 'scroll', label: '卷轴' },
  { key: 'lantern', label: '灯' },
  { key: 'moon', label: '月亮' },
  { key: 'star', label: '星星' },
  { key: 'mountain', label: '山' },
  { key: 'leaf', label: '叶子' },
  { key: 'fish', label: '鱼' },
  { key: 'cat', label: '猫' },
  { key: 'fox', label: '狐狸' }
]

const KEYS = new Set(AVATARS.map(item => item.key))

export const avatarKey = (value) => {
  const key = String(value ?? '').trim()
  return KEYS.has(key) ? key : null
}
