import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

/** Harness jetable — maquettes hydratation v2 (pas de code app modifié). */
export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, '../../public'),
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_ENABLE_ACCUEIL_GALLERY': JSON.stringify('true'),
    'import.meta.env.VITE_ENABLE_CALORIE_GOAL': JSON.stringify('false'),
    __APP_BUILD_ID__: JSON.stringify('mockups-hydratation-v2'),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
    },
  },
  server: {
    port: 4321,
    strictPort: true,
  },
})
