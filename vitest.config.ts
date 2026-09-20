import { defineConfig } from 'vitest/config'

export default defineConfig({
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
      ['src/components/ui/AppBootScreen.test.tsx', 'jsdom'],
      ['src/components/ui/BootIssueScreen.test.tsx', 'jsdom'],
      ['src/App.test.tsx', 'jsdom'],
      ['src/utils/streakCelebrationFocus.test.ts', 'jsdom'],
      ['src/utils/streakCelebrationSession.test.tsx', 'jsdom'],
    ],
  },
})
