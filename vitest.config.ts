import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['src/components/streak/**', 'jsdom'],
      ['src/utils/streakCelebrationFocus.test.ts', 'jsdom'],
      ['src/utils/streakCelebrationSession.test.tsx', 'jsdom'],
    ],
  },
})
