import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * SHA court pour la pastille Version (Réglages).
 * Workers Builds → WORKERS_CI_COMMIT_SHA ; Pages → CF_PAGES_COMMIT_SHA.
 * Sans SHA CI → `local` (dev machine uniquement, jamais en prod).
 * Doit rester aligné avec `APP_BUILD_SHA_ENV_KEYS` / `pickShortCommitSha` dans
 * `src/pwa/appBuildId.ts`.
 */
function resolveAppBuildId(): string {
  const fromEnv =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.VITE_APP_BUILD_ID ||
    process.env.GITHUB_SHA ||
    ''
  const short = fromEnv.trim().slice(0, 7)
  if (short) return short
  return 'local'
}

function resolveAppBuildTimeIso(): string {
  return new Date().toISOString()
}

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(resolveAppBuildId()),
    __APP_BUILD_TIME__: JSON.stringify(resolveAppBuildTimeIso()),
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'icon.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'Ranked Gym',
        short_name: 'Ranked Gym',
        description: 'Réseau social de musculation gamifié',
        lang: 'fr',
        theme_color: '#0C0C0E',
        background_color: '#0C0C0E',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,avif}'],
        // PNG source kept as <picture> fallback; 2.85 MB exceeds the default precache cap.
        globIgnores: ['**/auth-welcome-hero.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/assets\//, /^\/workbox-/, /^\/sw\.js$/, /^\/registerSW\.js$/],
      },
    }),
  ],
})
