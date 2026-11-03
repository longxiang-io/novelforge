// 密码用 PBKDF2-SHA256。新哈希 5 万次，避免免费套餐的 CPU 时间不够。
// 格式是 pbkdf2:<次数>:<盐>:<哈希>。旧的三段格式没有次数，按 10 万次校验。
export const PBKDF2_ITERATIONS = 50000
export const LEGACY_PBKDF2_ITERATIONS = 100000
const encoder = new TextEncoder()

const pbkdf2 = async (password, salt, iterations) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  )
  return new Uint8Array(bits)
}

const bytesToB64 = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const b64ToBytes = (text) => {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export const hashPassword = async (password, iterations = PBKDF2_ITERATIONS) => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, iterations)
  return `pbkdf2:${iterations}:${bytesToB64(salt)}:${bytesToB64(hash)}`
}

// 解析哈希串。返回 null 表示格式不对。
export const readPasswordHash = (stored) => {
  const parts = String(stored || '').split(':')
  if (parts[0] !== 'pbkdf2') return null
  if (parts.length === 4) {
    const iterations = Number(parts[1])
    if (!Number.isInteger(iterations) || iterations < 1 || !parts[2] || !parts[3]) return null
    return { iterations, salt: parts[2], hash: parts[3] }
  }
  if (parts.length === 3 && parts[1] && parts[2]) {
    return { iterations: LEGACY_PBKDF2_ITERATIONS, salt: parts[1], hash: parts[2] }
  }
  return null
}

export const needsRehash = (stored) => {
  const parsed = readPasswordHash(stored)
  return !!parsed && parsed.iterations > PBKDF2_ITERATIONS
}

export const verifyPassword = async (password, stored) => {
  const parsed = readPasswordHash(stored)
  if (!parsed) return false
  try {
    const salt = b64ToBytes(parsed.salt)
    const expected = b64ToBytes(parsed.hash)
    const actual = await pbkdf2(password, salt, parsed.iterations)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
