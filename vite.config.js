import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 前端单独用 Vite 打成静态文件，由 Workers Static Assets 托管。
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: false })],
      dts: false
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: false })],
      dts: false
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
