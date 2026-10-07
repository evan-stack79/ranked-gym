import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify('test'),
    __APP_BUILD_TIME__: JSON.stringify('2026-10-06T00:05:00.000Z'),
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['src/components/streak/**', 'jsdom'],
      ['src/components/brand/**', 'jsdom'],
      ['src/components/auth/**', 'jsdom'],
      ['src/components/legal/**', 'jsdom'],
      ['src/components/training/**/*.test.tsx', 'jsdom'],
      ['src/components/settings/**/*.test.tsx', 'jsdom'],
      ['src/components/nutrition/**/*.test.tsx', 'jsdom'],
      ['src/components/profile/**/*.test.tsx', 'jsdom'],
      ['src/components/onboarding/**/*.test.tsx', 'jsdom'],
      ['src/components/home/**/*.test.tsx', 'jsdom'],
      ['src/components/ui/AppBootScreen.test.tsx', 'jsdom'],
      ['src/components/ui/BootIssueScreen.test.tsx', 'jsdom'],
      ['src/App.test.tsx', 'jsdom'],
      ['src/utils/streakCelebrationFocus.test.ts', 'jsdom'],
      ['src/utils/streakCelebrationSession.test.tsx', 'jsdom'],
    ],
  },
})
