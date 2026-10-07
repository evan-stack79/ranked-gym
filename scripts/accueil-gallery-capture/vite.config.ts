import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, '../../public'),
  plugins: [react(), tailwindcss()],
  define: {
    // Flag ON by default in app; keep explicit for harness clarity.
    'import.meta.env.VITE_ENABLE_ACCUEIL_GALLERY': JSON.stringify('true'),
    'import.meta.env.VITE_ENABLE_CALORIE_GOAL': JSON.stringify('false'),
    __APP_BUILD_ID__: JSON.stringify('accueil-gallery-capture'),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
    },
  },
  server: {
    port: 4198,
    strictPort: true,
  },
})
