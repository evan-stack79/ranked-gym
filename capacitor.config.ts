import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rankedgym.app',
  appName: 'Ranked Gym',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
}

export default config
