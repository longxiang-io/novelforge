import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

// Fragments sit beside the base catalogs so page copy can land without editing them.
const fragmentModules = import.meta.glob('./locales/fragments/*.json', { eager: true })

const mergeMessages = (base, extra) => {
  const out = { ...base }
  for (const [key, value] of Object.entries(extra || {})) {
    const current = out[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
      out[key] = mergeMessages(current, value)
    } else {
      out[key] = value
    }
  }
  return out
}

const withFragments = (locale, base) => {
  const suffix = locale === 'zh-CN' ? '.zh-CN.json' : '.en.json'
  let messages = base
  for (const [file, mod] of Object.entries(fragmentModules)) {
    if (!file.endsWith(suffix)) continue
    messages = mergeMessages(messages, mod.default || mod)
  }
  return messages
}

export const LOCALE_KEY = 'novelforge-locale'

export const readLocale = () => {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    if (saved === 'en' || saved === 'zh-CN') return saved
  } catch {
    // localStorage can be unavailable. English stays the default.
  }
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: readLocale(),
  fallbackLocale: 'en',
  messages: {
    en: withFragments('en', en),
    'zh-CN': withFragments('zh-CN', zhCN)
  }
})

export const setLocale = (next) => {
  const locale = next === 'zh-CN' ? 'zh-CN' : 'en'
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Ignore storage failures. The in-memory locale still changes.
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en'
  }
}
