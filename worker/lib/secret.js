import { decryptString, encryptString } from './crypto.js'
import { getEnv } from '../env.js'

const keyOf = () => {
  const key = getEnv().ENCRYPTION_KEY
  if (!key) throw new Error('未配置 ENCRYPTION_KEY')
  return key
}

export const encryptSecret = (plain) => encryptString(plain, keyOf())

export const decryptSecret = (stored) => decryptString(stored, keyOf())

export const maskStoredSecret = async (stored) => {
  if (!stored) return ''
  try {
    const plain = await decryptSecret(stored)
    return `••••••••${plain.slice(-4)}`
  } catch {
    return '••••••••（无法解密）'
  }
}

export const isMaskedInput = (value) => String(value || '').includes('•')
