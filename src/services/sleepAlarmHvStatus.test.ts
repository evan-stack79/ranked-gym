import { beforeEach, describe, expect, it, vi } from 'vitest'

const memoryStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem(k: string) {
    return memoryStore[k] ?? null
  },
  setItem(k: string, v: string) {
    memoryStore[k] = String(v)
  },
  removeItem(k: string) {
    delete memoryStore[k]
  },
  clear() {
    for (const k of Object.keys(memoryStore)) delete memoryStore[k]
  },
})

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

const getAlarms = vi.fn()
const checkPermissions = vi.fn()
const isAvailable = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    isPluginAvailable: () => true,
  },
  registerPlugin: () => ({
    isAvailable: (...a: unknown[]) => isAvailable(...a),
    checkPermissions: (...a: unknown[]) => checkPermissions(...a),
    requestPermissions: async () => ({ alarms: 'granted' }),
    createAlarm: async () => ({ id: 'x' }),
    cancelAlarm: async () => {},
    cancelAll: async () => ({ remaining: 0 }),
    getAlarms: (...a: unknown[]) => getAlarms(...a),
    verifyAlarm: async () => ({ present: true }),
    openAppSettings: async () => {},
    getDiagnostics: async () => ({
      native: true,
      iosVersion: '26',
      alarmKitAvailable: true,
      authorization: 'authorized',
      alarmCount: 0,
      lastError: null,
      hasUsageDescription: true,
    }),
    getBattery: async () => ({ level: 0.5, charging: false, unknown: false }),
    scheduleTestInOneMinute: async () => ({ id: 't', secondsFromNow: 60 }),
    consumePendingMorningPrompt: async () => ({ pending: false }),
  }),
}))

const isHvModeActive = vi.fn()
const getHvState = vi.fn()
vi.mock('./horairesVariables/storage', () => ({
  isHvModeActive: () => isHvModeActive(),
  getHvState: () => getHvState(),
}))

const buildArmedWakes = vi.fn()
vi.mock('../horaires-variables/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../horaires-variables/engine')>()
  return {
    ...actual,
    buildArmedWakes: (...args: unknown[]) => buildArmedWakes(...args),
  }
})

function fakeAlarms(n: number) {
  const now = Date.now()
  return Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    hour: 6 + (i % 4),
    minute: i,
    repeats: 'fixed',
    nextFireAtMs: now + (i + 1) * 3_600_000,
  }))
}

describe('readSleepAlarmUiStatus — HV vs réveil simple', () => {
  beforeEach(async () => {
    localStorage.clear()
    getAlarms.mockReset()
    checkPermissions.mockReset()
    isAvailable.mockReset()
    isHvModeActive.mockReset()
    getHvState.mockReset()
    buildArmedWakes.mockReset()

    isAvailable.mockResolvedValue({ available: true })
    checkPermissions.mockResolvedValue({ alarms: 'granted' })
    isHvModeActive.mockReturnValue(false)
    getHvState.mockReturnValue({
      settings: { enabled: false, trajetMin: 30, prepMin: 45 },
      days: [],
      armedAlarmIds: [],
    })
    buildArmedWakes.mockReturnValue([])

    const { saveSleepAlarmSettings } = await import('./sleepAlarmStorage')
    saveSleepAlarmSettings({
      enabled: true,
      timeHm: '07:00',
      days: [],
      label: 'Réveil',
    })
  })

  it('HV with ~10 armed wakes matching expected → scheduled (no Trop de réveils)', async () => {
    isHvModeActive.mockReturnValue(true)
    getHvState.mockReturnValue({
      settings: { enabled: true, trajetMin: 30, prepMin: 45 },
      days: [],
      armedAlarmIds: [],
    })
    buildArmedWakes.mockReturnValue(
      Array.from({ length: 10 }, (_, i) => ({ dateKey: `2026-11-${10 + i}`, wakeHm: '06:30' })),
    )
    getAlarms.mockResolvedValue({ alarms: fakeAlarms(10) })

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('scheduled')
    expect(status).not.toMatchObject({ message: 'Trop de réveils. Règle-le à nouveau.' })
  })

  it('HV with fewer armed than expected → mismatch alert', async () => {
    isHvModeActive.mockReturnValue(true)
    getHvState.mockReturnValue({
      settings: { enabled: true, trajetMin: 30, prepMin: 45 },
      days: [],
      armedAlarmIds: [],
    })
    buildArmedWakes.mockReturnValue(
      Array.from({ length: 10 }, (_, i) => ({ dateKey: `2026-11-${10 + i}`, wakeHm: '06:30' })),
    )
    getAlarms.mockResolvedValue({ alarms: fakeAlarms(3) })

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('mismatch')
    if (status.kind === 'mismatch') {
      expect(status.expected).toBe(10)
      expect(status.actual).toBe(3)
      expect(status.message).not.toBe('Trop de réveils. Règle-le à nouveau.')
    }
  })

  it('réveil simple unchanged: not 1 alarm → Trop de réveils', async () => {
    isHvModeActive.mockReturnValue(false)
    getAlarms.mockResolvedValue({ alarms: fakeAlarms(10) })

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status).toEqual({
      kind: 'mismatch',
      expected: 1,
      actual: 10,
      message: 'Trop de réveils. Règle-le à nouveau.',
    })
  })

  it('réveil simple unchanged: exactly 1 alarm → scheduled', async () => {
    isHvModeActive.mockReturnValue(false)
    getAlarms.mockResolvedValue({ alarms: fakeAlarms(1) })

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('scheduled')
  })
})
