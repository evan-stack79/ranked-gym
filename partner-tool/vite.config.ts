import { defineConfig } from 'vite'

/** Separate Vite app — never bundled into the Capacitor player build. */
export default defineConfig({
  root: '.',
  base: '/',
  server: {
    host: true,
    port: 5180,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 5180,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
