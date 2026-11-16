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

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

const getAlarms = vi.fn()
const checkPermissions = vi.fn()
const isAvailable = vi.fn()
const createAlarm = vi.fn()
const cancelAlarm = vi.fn()
const cancelAll = vi.fn()
const requestPermissions = vi.fn()

const liveAlarms = new Map<string, { id: string; hour?: number; minute?: number; nextFireAtMs?: number }>()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    isPluginAvailable: () => true,
  },
  registerPlugin: () => ({
    isAvailable: (...a: unknown[]) => isAvailable(...a),
    checkPermissions: (...a: unknown[]) => checkPermissions(...a),
    requestPermissions: (...a: unknown[]) => requestPermissions(...a),
    createAlarm: (...a: unknown[]) => createAlarm(...a),
    cancelAlarm: (...a: unknown[]) => cancelAlarm(...a),
    cancelAll: (...a: unknown[]) => cancelAll(...a),
    getAlarms: (...a: unknown[]) => getAlarms(...a),
    verifyAlarm: async () => ({ present: true }),
    openAppSettings: async () => {},
    getDiagnostics: async () => ({
      native: true,
      iosVersion: '26',
      alarmKitAvailable: true,
      authorization: 'authorized',
      alarmCount: liveAlarms.size,
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
const saveHvState = vi.fn()
vi.mock('./horairesVariables/storage', () => ({
  isHvModeActive: () => isHvModeActive(),
  getHvState: () => getHvState(),
  saveHvState: (...a: unknown[]) => saveHvState(...a),
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
    liveAlarms.clear()
    getAlarms.mockReset()
    checkPermissions.mockReset()
    isAvailable.mockReset()
    createAlarm.mockReset()
    cancelAlarm.mockReset()
    cancelAll.mockReset()
    requestPermissions.mockReset()
    isHvModeActive.mockReset()
    getHvState.mockReset()
    saveHvState.mockReset()
    buildArmedWakes.mockReset()

    isAvailable.mockResolvedValue({ available: true })
    checkPermissions.mockResolvedValue({ alarms: 'granted' })
    requestPermissions.mockResolvedValue({ alarms: 'granted' })
    isHvModeActive.mockReturnValue(false)
    getHvState.mockReturnValue({
      settings: { enabled: false, trajetMin: 30, prepMin: 45 },
      days: [],
      armedAlarmIds: [],
    })
    saveHvState.mockImplementation((patch: { armedAlarmIds?: string[] }) => {
      const cur = getHvState()
      getHvState.mockReturnValue({ ...cur, ...patch })
    })
    buildArmedWakes.mockReturnValue([])
    getAlarms.mockImplementation(async () => ({ alarms: [...liveAlarms.values()] }))
    cancelAlarm.mockImplementation(async ({ id }: { id: string }) => {
      liveAlarms.delete(id)
    })
    cancelAll.mockImplementation(async (opts?: { keepId?: string }) => {
      const keep = opts?.keepId
      for (const id of [...liveAlarms.keys()]) {
        if (id !== keep) liveAlarms.delete(id)
      }
      return { remaining: liveAlarms.size }
    })
    createAlarm.mockImplementation(async () => {
      const id = 'simple-1'
      liveAlarms.clear()
      liveAlarms.set(id, {
        id,
        hour: 7,
        minute: 0,
        nextFireAtMs: Date.now() + 3_600_000,
      })
      return { id }
    })

    const { saveSleepAlarmSettings } = await import('./sleepAlarmStorage')
    saveSleepAlarmSettings({
      enabled: true,
      timeHm: '07:00',
      days: [],
      label: 'Réveil',
    })

    const { __resetHvSyncGateForTests } = await import('./horairesVariables/sync')
    __resetHvSyncGateForTests()
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
    for (const a of fakeAlarms(10)) liveAlarms.set(a.id, a)

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
    for (const a of fakeAlarms(3)) liveAlarms.set(a.id, a)

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('mismatch')
    if (status.kind === 'mismatch') {
      expect(status.expected).toBe(10)
      expect(status.actual).toBe(3)
      expect(status.message).not.toBe('Trop de réveils. Règle-le à nouveau.')
    }
  })

  it('planning off + 10 leftover HV alarms → cleanup → 1 alarm, no Trop de réveils', async () => {
    isHvModeActive.mockReturnValue(false)
    const hvIds = Array.from({ length: 9 }, (_, i) => `hv-${i}`)
    getHvState.mockReturnValue({
      settings: { enabled: false, trajetMin: 30, prepMin: 45 },
      days: [],
      armedAlarmIds: hvIds,
    })
    for (const id of hvIds) {
      liveAlarms.set(id, { id, hour: 6, minute: 0, nextFireAtMs: Date.now() + 3_600_000 })
    }
    liveAlarms.set('old-simple', {
      id: 'old-simple',
      hour: 7,
      minute: 0,
      nextFireAtMs: Date.now() + 7_200_000,
    })
    expect(liveAlarms.size).toBe(10)

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('scheduled')
    expect(status).not.toMatchObject({ message: 'Trop de réveils. Règle-le à nouveau.' })
    expect(liveAlarms.size).toBe(1)
    expect(liveAlarms.has('simple-1')).toBe(true)
    expect(createAlarm).toHaveBeenCalled()
  })

  it('réveil simple unchanged: not 1 alarm and no HV leftovers → Trop de réveils', async () => {
    isHvModeActive.mockReturnValue(false)
    getHvState.mockReturnValue({
      settings: { enabled: false, trajetMin: 30, prepMin: 45 },
      days: [],
      armedAlarmIds: [],
    })
    // createAlarm clears then adds 1; simulate stuck extras after restore by forcing getAlarms
    createAlarm.mockImplementation(async () => {
      liveAlarms.clear()
      liveAlarms.set('simple-1', { id: 'simple-1', hour: 7, minute: 0 })
      liveAlarms.set('ghost', { id: 'ghost', hour: 8, minute: 0 })
      return { id: 'simple-1' }
    })
    for (const a of fakeAlarms(2)) liveAlarms.set(a.id, a)

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('mismatch')
    if (status.kind === 'mismatch') {
      expect(status.message).toBe('Trop de réveils. Règle-le à nouveau.')
    }
  })

  it('réveil simple unchanged: exactly 1 alarm → scheduled', async () => {
    isHvModeActive.mockReturnValue(false)
    for (const a of fakeAlarms(1)) liveAlarms.set(a.id, a)

    const { readSleepAlarmUiStatus } = await import('./sleepAlarmService')
    const status = await readSleepAlarmUiStatus()
    expect(status.kind).toBe('scheduled')
  })
})
