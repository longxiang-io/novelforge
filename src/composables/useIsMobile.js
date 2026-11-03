import { ref } from 'vue'

// 手机布局：视口宽度不超过 768，并且设备报告为触屏。
// 窗口缩放或旋转时重新判断。桌面浏览器只是把窗口拉窄，仍用桌面布局。
export const MOBILE_MAX_WIDTH = 768

export const isMobile = ref(false)
export const keyboardInset = ref(0)

let started = false

export function detectTouch() {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const hoverNone = window.matchMedia('(hover: none)').matches
  const points = navigator.maxTouchPoints > 0
  const ontouch = 'ontouchstart' in window
  return (coarse && (points || hoverNone)) || (hoverNone && points) || (ontouch && points)
}

function updateMobile() {
  const width = window.innerWidth
  const mobile = width <= MOBILE_MAX_WIDTH && detectTouch()
  isMobile.value = mobile
  document.documentElement.classList.toggle('cj-mobile', mobile)

  const vv = window.visualViewport
  if (!mobile || !vv) {
    keyboardInset.value = 0
    document.documentElement.style.removeProperty('--cj-vv-top')
    document.documentElement.style.removeProperty('--cj-vv-height')
    document.documentElement.style.removeProperty('--cj-keyboard-inset')
    return
  }

  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  keyboardInset.value = inset
  document.documentElement.style.setProperty('--cj-vv-top', `${Math.round(vv.offsetTop)}px`)
  document.documentElement.style.setProperty('--cj-vv-height', `${Math.round(vv.height)}px`)
  document.documentElement.style.setProperty('--cj-keyboard-inset', `${inset}px`)
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  updateMobile()
  window.addEventListener('resize', updateMobile)
  window.addEventListener('orientationchange', updateMobile)
  window.visualViewport?.addEventListener('resize', updateMobile)
  window.visualViewport?.addEventListener('scroll', updateMobile)
  for (const query of ['(pointer: coarse)', '(hover: none)', '(max-width: 768px)']) {
    window.matchMedia(query).addEventListener('change', updateMobile)
  }
}

export function useIsMobile() {
  start()
  return { isMobile, keyboardInset }
}
