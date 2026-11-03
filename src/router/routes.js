export const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/landing/Landing.vue'),
    meta: { public: true, title: 'meta.landing' }
  },
  {
    path: '/guide',
    name: 'guide',
    component: () => import('../views/landing/Guide.vue'),
    meta: { public: true, allowWhenLoggedIn: true, title: 'nav.guide' }
  },
  { path: '/login', name: 'login', component: () => import('../views/auth/AuthPage.vue'), meta: { public: true, mode: 'login', title: 'nav.login' } },
  { path: '/register', name: 'register', component: () => import('../views/auth/AuthPage.vue'), meta: { public: true, mode: 'register', title: 'nav.register' } },
  {
    path: '/changjuan',
    component: () => import('../views/changjuan/ChangjuanLayout.vue'),
    children: [
      { path: '', name: 'changjuanShelf', component: () => import('../views/changjuan/Bookshelf.vue'), meta: { title: 'nav.shelf' } },
      { path: 'account', name: 'changjuanAccount', component: () => import('../views/changjuan/Account.vue'), meta: { title: 'nav.account' } },
      { path: 'settings', name: 'changjuanSettings', component: () => import('../views/changjuan/Settings.vue'), meta: { title: 'nav.settings' } },
      { path: 'book/:bookId', redirect: to => `/changjuan/book/${to.params.bookId}/write` },
      { path: 'book/:bookId/write/:chapterId?', name: 'changjuanWrite', component: () => import('../views/changjuan/Writing.vue'), meta: { title: 'nav.write', nav: 'write' } },
      { path: 'book/:bookId/memory', name: 'changjuanMemory', component: () => import('../views/changjuan/Memory.vue'), meta: { title: 'nav.memory', nav: 'memory' } },
      { path: 'book/:bookId/foreshadows', name: 'changjuanForeshadows', component: () => import('../views/changjuan/Foreshadows.vue'), meta: { title: 'nav.foreshadows', nav: 'foreshadows' } },
      { path: 'book/:bookId/outline', name: 'changjuanOutline', component: () => import('../views/changjuan/Outline.vue'), meta: { title: 'nav.outline', nav: 'outline' } },
      { path: 'book/:bookId/stats', name: 'changjuanStats', component: () => import('../views/changjuan/Stats.vue'), meta: { title: 'nav.stats', nav: 'stats' } },
      { path: 'book/:bookId/read', name: 'changjuanRead', component: () => import('../views/changjuan/Read.vue'), meta: { title: 'nav.read', nav: 'read' } },
      { path: 'book/:bookId/search', name: 'changjuanSearch', component: () => import('../views/changjuan/Search.vue'), meta: { title: 'nav.search', nav: 'search' } },
      { path: 'book/:bookId/settings', name: 'changjuanBookSettings', component: () => import('../views/changjuan/Settings.vue'), meta: { title: 'nav.settings' } },
      { path: 'book/:bookId/versions', name: 'changjuanVersions', component: () => import('../views/changjuan/Versions.vue'), meta: { title: 'nav.versions' } }
    ]
  }
]
