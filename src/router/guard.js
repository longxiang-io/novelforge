// 介绍页、登录、注册和使用说明标了 public。
// 已登录再打开介绍页、登录或注册，直接去书架。使用说明标了 allowWhenLoggedIn，登录后仍可阅读。
export function decideNavigation(to, { token, isAdmin } = {}) {
  if (!token && !to.meta?.public) {
    return {
      name: 'login',
      query: to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {}
    }
  }
  if (token && to.meta?.public && !to.meta?.allowWhenLoggedIn) return { path: '/changjuan' }
  if (to.meta?.admin && !isAdmin) return { path: '/changjuan' }
  return true
}
