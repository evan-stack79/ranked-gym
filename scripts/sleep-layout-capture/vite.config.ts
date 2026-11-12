import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, '../../public'),
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_ENABLE_ACCUEIL_GALLERY': JSON.stringify('true'),
    'import.meta.env.VITE_ENABLE_CALORIE_GOAL': JSON.stringify('false'),
    'import.meta.env.VITE_GIT_SHA': JSON.stringify('sleep-layout'),
    __APP_BUILD_ID__: JSON.stringify('sleep-layout'),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
    },
  },
  server: {
    port: 4227,
    strictPort: true,
  },
})
