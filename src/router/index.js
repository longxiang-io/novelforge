import { createRouter, createWebHistory } from 'vue-router'
import { i18n } from '../i18n.js'
import { readStoredUser } from '../utils/authSession.js'
import { decideNavigation } from './guard.js'
import { routes } from './routes.js'

export const applyDocumentTitle = (to) => {
  const key = to?.meta?.title
  if (to?.name === 'landing') {
    document.title = i18n.global.t('meta.landing')
    return
  }
  document.title = key ? `${i18n.global.t(key)} · NovelForge` : 'NovelForge'
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 76 }
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  applyDocumentTitle(to)
  const decision = decideNavigation(to, {
    token: localStorage.getItem('token'),
    isAdmin: readStoredUser().role === 'admin'
  })
  if (decision !== true) return decision
})

export default router
