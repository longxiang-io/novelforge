import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { decideNavigation } from '../src/router/guard.js'
import { routes } from '../src/router/routes.js'

const routeByPath = (path) => {
  const route = routes.find(item => item.path === path)
  assert.ok(route, path)
  return route
}

const visit = (path, extra = {}) => {
  const route = routeByPath(path)
  return {
    path,
    fullPath: extra.fullPath || path,
    name: route.name,
    meta: route.meta || {}
  }
}

const chars = (...codes) => String.fromCharCode(...codes)
const COMMERCIAL = new RegExp([
  chars(107, 97, 110, 107, 97, 110),
  chars(76, 88, 49, 49, 51, 53, 53),
  chars(0x6fc0, 0x6d3b, 0x7801),
  chars(0x63a8, 0x8350, 0x7801),
  chars(0x9080, 0x8bf7, 0x7801),
  chars(0x5ba2, 0x670d),
  chars(0x4f1a, 0x5458),
  'SupportChat',
  'guide\\/ark',
  chars(0x8d2d, 0x4e70)
].join('|'))

test('guests see the landing page and signed-in users go to the bookshelf', () => {
  const home = routeByPath('/')
  assert.equal(home.name, 'landing')
  assert.equal(home.meta.public, true)
  assert.equal(decideNavigation(visit('/'), { token: null, isAdmin: false }), true)
  assert.deepEqual(decideNavigation(visit('/'), { token: 'token', isAdmin: false }), { path: '/changjuan' })
})

test('login and register stay public, and there is no admin or commercial guide route', () => {
  for (const path of ['/login', '/register']) {
    const route = routeByPath(path)
    assert.equal(route.meta.public, true)
    assert.deepEqual(decideNavigation(visit(path), { token: 'token', isAdmin: false }), { path: '/changjuan' })
  }
  assert.equal(routes.some(item => item.path === '/admin' || item.path === '/guide/ark'), false)
  assert.deepEqual(
    decideNavigation({ path: '/changjuan', fullPath: '/changjuan/book/2/write', meta: {} }, { token: null, isAdmin: false }),
    { name: 'login', query: { redirect: '/changjuan/book/2/write' } }
  )
})

test('the guide stays readable after login', () => {
  const route = routeByPath('/guide')
  assert.equal(route.meta.public, true)
  assert.equal(route.meta.allowWhenLoggedIn, true)
  assert.equal(decideNavigation(visit('/guide'), { token: 'token', isAdmin: false }), true)
})

test('landing, auth, and guide do not mention the commercial service', async () => {
  for (const file of [
    '../src/views/landing/Landing.vue',
    '../src/views/landing/Guide.vue',
    '../src/views/auth/AuthPage.vue',
    '../index.html'
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, COMMERCIAL, file)
  }
  const landing = await readFile(new URL('../src/views/landing/Landing.vue', import.meta.url), 'utf8')
  assert.match(landing, /to="\/login"/)
  assert.match(landing, /to="\/register"/)
  assert.match(landing, /to="\/guide"/)
  assert.match(landing, /LocaleSwitch/)
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /NovelForge/)
  assert.match(html, /lang="en"/)
})

test('landing styles keep the paper palette and no gradient', async () => {
  const css = await readFile(new URL('../src/views/landing/landing.css', import.meta.url), 'utf8')
  for (const color of ['#b13b20', '#fbefeb', '#efcfc6', '#9b1c31', '#b7791f']) {
    assert.ok(css.includes(color), color)
  }
  assert.match(css, /prefers-reduced-motion/)
  assert.doesNotMatch(css, /gradient/i)
})
