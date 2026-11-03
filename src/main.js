import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { i18n } from './i18n.js'
import { Icon } from 'tdesign-icons-vue-next'
import 'element-plus/dist/index.css'
import './assets/main.css'
import './views/changjuan/mobile.css'

const app = createApp(App)
app.use(router)
app.use(i18n)
app.component('TIcon', Icon)
app.mount('#app')
