// 模型密钥：AES-256-GCM。密钥材料经 SHA-256 收成 32 字节，格式 enc:v1:iv:tag:data。
const PREFIX = 'enc:v1:'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const bytesToB64 = (bytes) => {
  let binary = ''
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export const b64ToBytes = (text) => {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

const importAesKey = async (material) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(material)))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export const encryptString = async (plain, keyMaterial) => {
  const text = String(plain || '')
  if (!text) return ''
  if (!keyMaterial) throw new Error('未配置 ENCRYPTION_KEY')
  const key = await importAesKey(keyMaterial)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text)))
  const data = encrypted.slice(0, -16)
  const tag = encrypted.slice(-16)
  return `${PREFIX}${bytesToB64(iv)}:${bytesToB64(tag)}:${bytesToB64(data)}`
}

export const decryptString = async (stored, keyMaterial) => {
  const text = String(stored || '')
  if (!text) return ''
  if (!text.startsWith(PREFIX)) throw new Error('密钥格式不正确，请重新填写')
  if (!keyMaterial) throw new Error('未配置 ENCRYPTION_KEY')
  const [ivText, tagText, dataText] = text.slice(PREFIX.length).split(':')
  try {
    const key = await importAesKey(keyMaterial)
    const iv = b64ToBytes(ivText)
    const tag = b64ToBytes(tagText)
    const data = b64ToBytes(dataText)
    const combined = new Uint8Array(data.length + tag.length)
    combined.set(data, 0)
    combined.set(tag, data.length)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined)
    return decoder.decode(plain)
  } catch (err) {
    if (err instanceof Error && err.message === '未配置 ENCRYPTION_KEY') throw err
    throw new Error('密钥无法解密（服务器密钥可能已更换），请在设置页重新填写')
  }
}
