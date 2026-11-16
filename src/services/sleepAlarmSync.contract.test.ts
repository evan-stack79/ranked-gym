import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const createAlarm = vi.fn()
const cancelAll = vi.fn()
const cancelAlarm = vi.fn()
const verifyAlarm = vi.fn()
const requestPermissions = vi.fn()
const isAvailable = vi.fn()
const getAlarms = vi.fn()
const checkPermissions = vi.fn()

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
    verifyAlarm: (...a: unknown[]) => verifyAlarm(...a),
    openAppSettings: async () => {},
    getDiagnostics: async () => ({
      native: true,
      iosVersion: '26',
      alarmKitAvailable: true,
      authorization: 'authorized',
      alarmCount: 1,
      lastError: null,
      hasUsageDescription: true,
    }),
    getBattery: async () => ({ level: 0.5, charging: false, unknown: false }),
    scheduleTestInOneMinute: async () => ({ id: 't', secondsFromNow: 60 }),
    consumePendingMorningPrompt: async () => ({ pending: false }),
  }),
}))

describe('sleepAlarm sync reliability', () => {
  beforeEach(() => {
    localStorage.clear()
    createAlarm.mockReset()
    cancelAll.mockReset()
    cancelAlarm.mockReset()
    verifyAlarm.mockReset()
    requestPermissions.mockReset()
    isAvailable.mockReset()
    getAlarms.mockReset()
    checkPermissions.mockReset()
    isAvailable.mockResolvedValue({ available: true })
    requestPermissions.mockResolvedValue({ alarms: 'granted' })
    verifyAlarm.mockResolvedValue({ present: true })
    createAlarm.mockResolvedValue({ id: 'new-id' })
    cancelAll.mockResolvedValue({ remaining: 0 })
    getAlarms.mockResolvedValue({ alarms: [] })
    checkPermissions.mockResolvedValue({ alarms: 'granted' })
  })

  afterEach(async () => {
    const mod = await import('./sleepAlarmService')
    mod.__resetSleepAlarmSyncGateForTests()
  })

  it('make-before-break: never cancelAll/cancelAlarm before create+verify', async () => {
    const order: string[] = []
    createAlarm.mockImplementation(async () => {
      order.push('create')
      return { id: 'new-id' }
    })
    verifyAlarm.mockImplementation(async () => {
      order.push('verify')
      return { present: true }
    })
    cancelAll.mockImplementation(async () => {
      order.push('cancelAll')
      return { remaining: 0 }
    })
    cancelAlarm.mockImplementation(async () => {
      order.push('cancelAlarm')
    })

    const { syncSleepAlarm, makeBeforeBreakSteps, __resetSleepAlarmSyncGateForTests } =
      await import('./sleepAlarmService')
    __resetSleepAlarmSyncGateForTests()
    await syncSleepAlarm({ timeHm: '07:00', days: [], enabled: true })

    // JS must not cancel before create. Native cancelAll(except:) runs inside createAlarm.
    expect(order[0]).toBe('create')
    expect(order[1]).toBe('verify')
    expect(order.indexOf('cancelAlarm')).toBe(-1)
    expect(makeBeforeBreakSteps()).toEqual(['create', 'verify', 'cancelOthers'])
  })

  it('serialization: last request wins (superseded mid-flight)', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    createAlarm.mockImplementation(async (opts: { minute: number }) => {
      if (opts.minute === 0) {
        await gate
      }
      return { id: `id-${opts.minute}` }
    })

    const { syncSleepAlarm, __resetSleepAlarmSyncGateForTests } = await import(
      './sleepAlarmService'
    )
    __resetSleepAlarmSyncGateForTests()

    const first = syncSleepAlarm({ timeHm: '07:00', days: [], enabled: true })
    await Promise.resolve()
    const middle = syncSleepAlarm({ timeHm: '07:10', days: [], enabled: true })
    const last = syncSleepAlarm({ timeHm: '07:15', days: [], enabled: true })
    release()
    const [a, b, c] = await Promise.all([first, middle, last])
    expect(c.ok).toBe(true)
    expect(c.superseded).toBeFalsy()
    // Middle waited behind first, then saw a newer token → superseded.
    expect(b.superseded || b.ok).toBe(true)
    if (b.superseded) expect(b.reason).toBe('SUPERSEDED')
    expect(a.ok || a.superseded).toBe(true)
    expect(createAlarm.mock.calls.at(-1)?.[0]?.minute).toBe(15)
  })

  it('Dormir maintenant path passes empty days (one-shot)', async () => {
    const { syncSleepAlarm, __resetSleepAlarmSyncGateForTests } = await import(
      './sleepAlarmService'
    )
    __resetSleepAlarmSyncGateForTests()
    await syncSleepAlarm({ timeHm: '07:00', days: [], enabled: true })
    expect(createAlarm).toHaveBeenCalled()
    const arg = createAlarm.mock.calls[0][0]
    expect(arg.days).toBeUndefined()
  })
})
