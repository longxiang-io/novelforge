import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { i18n } from '../i18n.js'

let handledExpiredToken = null

// 同一令牌被多个请求同时判定失效时，只提示并跳转一次。
export const handleAuthExpired = (token, router) => {
  if (!token || handledExpiredToken === token) return false
  const currentToken = localStorage.getItem('token')
  if (currentToken !== token) return false

  handledExpiredToken = token
  clearSession()

  ElMessage.warning({
    message: i18n.global.t('auth.sessionExpired'),
    grouping: true
  })

  if (router.currentRoute.value.name !== 'login') {
    void router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  }
  return true
}

export const resetAuthExpiredState = () => {
  handledExpiredToken = null
}

export const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

export const sessionUser = ref(readStoredUser())

export const saveSession = (token, user) => {
  if (typeof token === 'string' && token) localStorage.setItem('token', token)
  if (user && typeof user === 'object') {
    localStorage.setItem('user', JSON.stringify(user))
    sessionUser.value = user
  }
}

export const clearSession = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  sessionUser.value = {}
}
