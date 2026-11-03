// 用 crypto.getRandomValues。字母表长度不是 2 的幂时丢掉越界字节，避免取模偏差。
export const randomFromAlphabet = (length, alphabet) => {
  const size = alphabet.length
  if (!Number.isInteger(length) || length < 1) throw new Error('长度不正确')
  if (size < 2 || size > 256) throw new Error('字母表长度不正确')
  const limit = 256 - (256 % size)
  const out = []
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - out.length))
    for (const byte of bytes) {
      if (byte >= limit) continue
      out.push(alphabet[byte % size])
      if (out.length === length) break
    }
  }
  return out.join('')
}

// 去掉 0/O/1/I/l，生成后只显示一次。
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export const randomPassword = (length = 12) => randomFromAlphabet(length, PASSWORD_ALPHABET)
