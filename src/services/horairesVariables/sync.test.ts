import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultHvSettings,
  defaultWeekSlots,
  emptyWeekSlots,
  defaultCycleWeeks,
  materializeDaysFromTemplates,
  buildArmedWakes,
  nextArmedWake,
  formatNextWakeLabelFr,
} from '../../horaires-variables/engine'
import {
  HV_ALARM_INACTIVE,
  HV_ALARMS_READY,
  HV_RED,
} from '../../horaires-variables/constants'
import { HV_IMPOSED_PHRASES } from '../../horaires-variables/phrases'

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

vi.mock('../cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

vi.mock('../cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

const createFixedAlarm = vi.fn()
const createAlarm = vi.fn()
const cancelAll = vi.fn()
const cancelAlarm = vi.fn()
const requestPermissions = vi.fn()
const getAlarms = vi.fn()
const verifyAlarm = vi.fn()

const liveAlarms = new Map<string, { id: string }>()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    isPluginAvailable: () => true,
  },
  registerPlugin: () => ({
    isAvailable: async () => ({ available: true }),
    checkPermissions: async () => ({ alarms: 'granted' }),
    requestPermissions: (...a: unknown[]) => requestPermissions(...a),
    createAlarm: (...a: unknown[]) => createAlarm(...a),
    createFixedAlarm: (...a: unknown[]) => createFixedAlarm(...a),
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
      alarmCount: liveAlarms.size,
      lastError: null,
      hasUsageDescription: true,
    }),
    getBattery: async () => ({ level: 0.5, charging: false, unknown: false }),
    scheduleTestInOneMinute: async () => ({ id: 't', secondsFromNow: 60 }),
    consumePendingMorningPrompt: async () => ({ pending: false }),
  }),
}))

async function seedEnabledPlanning(args?: { oldIds?: string[] }) {
  const { saveHvState } = await import('./storage')
  const settings = {
    ...defaultHvSettings(new Date('2026-11-15T22:30:00')),
    enabled: true,
    trajetMin: 75,
    prepMin: 30,
    cycleLength: 1 as const,
    weekARefMondayKey: '2026-11-09',
    weekASlots: defaultWeekSlots('08:00'),
    cycleWeeks: [{ letter: 'A' as const, name: 'A', slots: defaultWeekSlots('08:00') }],
    activatedAt: '2026-11-15T21:30:00.000Z',
    lastStartEditAt: '2026-11-15T21:30:00.000Z',
  }
  const days = materializeDaysFromTemplates({
    settings,
    fromDateKey: '2026-11-15',
    horizonDays: 14,
  })
  saveHvState({
    settings,
    days,
    armedAlarmIds: args?.oldIds ?? ['old-1', 'old-2'],
  })
}

describe('HV sync make-before-break + verify', () => {
  beforeEach(() => {
    localStorage.clear()
    liveAlarms.clear()
    createFixedAlarm.mockReset()
    createAlarm.mockReset()
    cancelAll.mockReset()
    cancelAlarm.mockReset()
    requestPermissions.mockReset()
    getAlarms.mockReset()
    verifyAlarm.mockReset()
    requestPermissions.mockResolvedValue({ alarms: 'granted' })
    cancelAll.mockResolvedValue({ remaining: 0 })
    cancelAlarm.mockImplementation(async ({ id }: { id: string }) => {
      liveAlarms.delete(id)
    })
    let n = 0
    createFixedAlarm.mockImplementation(async () => {
      n += 1
      const id = `new-${n}`
      liveAlarms.set(id, { id })
      return { id }
    })
    createAlarm.mockResolvedValue({ id: 'simple-1' })
    getAlarms.mockImplementation(async () => ({
      alarms: [...liveAlarms.values()],
    }))
  })

  afterEach(async () => {
    const { __resetHvSyncGateForTests } = await import('./sync')
    __resetHvSyncGateForTests()
  })

  it('(a) create fail after first: old alarms kept, no cancelAll, new rolled back', async () => {
    await seedEnabledPlanning({ oldIds: ['old-a', 'old-b'] })
    liveAlarms.set('old-a', { id: 'old-a' })
    liveAlarms.set('old-b', { id: 'old-b' })

    const order: string[] = []
    let n = 0
    createFixedAlarm.mockImplementation(async () => {
      n += 1
      order.push(`create:${n}`)
      if (n === 1) {
        const id = 'new-1'
        liveAlarms.set(id, { id })
        return { id }
      }
      order.push('fail')
      throw new Error('boom-after-first')
    })
    cancelAlarm.mockImplementation(async ({ id }: { id: string }) => {
      order.push(`cancel:${id}`)
      liveAlarms.delete(id)
    })
    cancelAll.mockImplementation(async () => {
      order.push('cancelAll')
      liveAlarms.clear()
      return { remaining: 0 }
    })

    const { syncHvAlarms, __resetHvSyncGateForTests, getHvSyncLastError } = await import(
      './sync'
    )
    __resetHvSyncGateForTests()

    const r = await syncHvAlarms(new Date(2026, 10, 15, 22, 30, 0))
    expect(r.ok).toBe(false)
    expect(order.includes('cancelAll')).toBe(false)
    expect(order[0]).toBe('create:1')
    expect(order).toContain('cancel:new-1')
    expect(liveAlarms.has('old-a')).toBe(true)
    expect(liveAlarms.has('old-b')).toBe(true)
    expect(liveAlarms.has('new-1')).toBe(false)
    expect(r.ids).toEqual(expect.arrayContaining(['old-a', 'old-b']))
    expect(getHvSyncLastError()).toBeTruthy()
  })

  it('(a) concurrent syncs do not interleave — coalesce into one rerun', async () => {
    await seedEnabledPlanning({ oldIds: ['old-1'] })
    liveAlarms.set('old-1', { id: 'old-1' })

    let bodies = 0
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    let seq = 0
    createFixedAlarm.mockImplementation(async () => {
      const my = ++seq
      if (my === 1) {
        bodies += 1
        await gate
      }
      const id = `new-${my}`
      liveAlarms.set(id, { id })
      return { id }
    })

    const { syncHvAlarms, __resetHvSyncGateForTests } = await import('./sync')
    __resetHvSyncGateForTests()
    const now = new Date(2026, 10, 15, 22, 30, 0)
    const p1 = syncHvAlarms(now)
    await Promise.resolve()
    await Promise.resolve()
    const p2 = syncHvAlarms(now)
    const p3 = syncHvAlarms(now)
    release()
    const results = await Promise.all([p1, p2, p3])
    expect(results.every((r) => r.ok)).toBe(true)
    // First body started once before release; merge may run a second body after.
    expect(bodies).toBe(1)
    expect(cancelAll).not.toHaveBeenCalled()
  })

  it('(a2) success: create all first, then cancel only old known ids', async () => {
    await seedEnabledPlanning({ oldIds: ['old-1'] })
    liveAlarms.set('old-1', { id: 'old-1' })
    const order: string[] = []
    let n = 0
    createFixedAlarm.mockImplementation(async () => {
      n += 1
      order.push('create')
      const id = `new-${n}`
      liveAlarms.set(id, { id })
      return { id }
    })
    cancelAlarm.mockImplementation(async ({ id }: { id: string }) => {
      order.push(`cancel:${id}`)
      liveAlarms.delete(id)
    })
    cancelAll.mockImplementation(async () => {
      order.push('cancelAll')
      return { remaining: 0 }
    })

    const { syncHvAlarms, __resetHvSyncGateForTests } = await import('./sync')
    __resetHvSyncGateForTests()
    const r = await syncHvAlarms(new Date(2026, 10, 15, 22, 30, 0))
    expect(r.ok).toBe(true)
    expect(r.armed).toBeGreaterThan(0)
    expect(order.includes('cancelAll')).toBe(false)
    expect(order[0]).toBe('create')
    expect(order.indexOf('cancel:old-1')).toBeGreaterThan(order.lastIndexOf('create'))
    expect(liveAlarms.has('old-1')).toBe(false)
  })

  it('(b) relecture missing → ok:false + lastError + missing', async () => {
    await seedEnabledPlanning({ oldIds: ['old-x'] })
    liveAlarms.set('old-x', { id: 'old-x' })
    createFixedAlarm.mockImplementation(async () => ({ id: 'ghost-1' }))
    getAlarms.mockResolvedValue({ alarms: [{ id: 'old-x' }] })

    const { syncHvAlarms, __resetHvSyncGateForTests, getHvSyncLastError } = await import(
      './sync'
    )
    __resetHvSyncGateForTests()
    const r = await syncHvAlarms(new Date(2026, 10, 15, 22, 30, 0))
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('MISSING_AFTER_SYNC')
    expect(r.missing?.length).toBeGreaterThan(0)
    expect(r.lastError).toMatch(/MISSING_AFTER_SYNC/)
    expect(getHvSyncLastError()).toMatch(/MISSING_AFTER_SYNC/)
    expect(r.ids).toContain('old-x')
  })

  it('planning OFF: cancel HV armed ids, restore simple createAlarm, clear armedAlarmIds', async () => {
    await seedEnabledPlanning({ oldIds: ['hv-1', 'hv-2'] })
    liveAlarms.set('hv-1', { id: 'hv-1' })
    liveAlarms.set('hv-2', { id: 'hv-2' })
    const { saveHvState, getHvState } = await import('./storage')
    saveHvState({ settings: { ...getHvState().settings, enabled: false } })
    const { saveSleepAlarmSettings } = await import('../sleepAlarmStorage')
    saveSleepAlarmSettings({ enabled: true, timeHm: '07:00', days: [] })

    const order: string[] = []
    cancelAlarm.mockImplementation(async ({ id }: { id: string }) => {
      order.push(`cancel:${id}`)
      liveAlarms.delete(id)
    })
    createAlarm.mockImplementation(async () => {
      order.push('createAlarm')
      liveAlarms.clear()
      liveAlarms.set('simple-new', { id: 'simple-new' })
      return { id: 'simple-new' }
    })
    cancelAll.mockImplementation(async () => {
      order.push('cancelAll')
      return { remaining: 0 }
    })

    const { syncHvAlarms, __resetHvSyncGateForTests } = await import('./sync')
    __resetHvSyncGateForTests()
    const r = await syncHvAlarms(new Date(2026, 10, 16, 12, 0, 0))
    expect(r.ok).toBe(true)
    expect(r.reason).toBe('OFF')
    expect(r.armed).toBe(1)
    expect(getHvState().armedAlarmIds).toEqual([])
    expect(order[0]).toMatch(/^cancel:/)
    expect(order).toContain('createAlarm')
    expect(order.includes('cancelAll')).toBe(false)
    expect(liveAlarms.size).toBe(1)
    expect(liveAlarms.has('simple-new')).toBe(true)
    expect(createFixedAlarm).not.toHaveBeenCalled()
  })
})

describe('HV next wake + empty week B + phrases', () => {
  it('(d) dimanche 15/11 22:30 cycle 1 → Lundi 06:15 ; B empty', () => {
    const now = new Date(2026, 10, 15, 22, 30, 0)
    const settings = {
      ...defaultHvSettings(now),
      trajetMin: 75,
      prepMin: 30,
      cycleLength: 1 as const,
      weekARefMondayKey: '2026-11-09',
      weekASlots: defaultWeekSlots('08:00'),
      cycleWeeks: [{ letter: 'A' as const, name: 'A', slots: defaultWeekSlots('08:00') }],
    }
    const days = materializeDaysFromTemplates({
      settings,
      fromDateKey: '2026-11-15',
      horizonDays: 14,
    })
    const wakes = buildArmedWakes({
      days,
      trajetMin: 75,
      prepMin: 30,
      fromDateKey: '2026-11-15',
      now,
    })
    const next = nextArmedWake(wakes, now)
    expect(next?.dateKey).toBe('2026-11-16')
    expect(next?.wakeHm).toBe('06:15')
    expect(formatNextWakeLabelFr(next!)).toBe('Lundi 06:15')

    const two = defaultCycleWeeks(2)
    expect(two[1]!.slots.every((s) => s.kind === 'repos' || s.startHm == null)).toBe(true)
    expect(emptyWeekSlots().find((s) => s.weekday === 1)?.startHm).toBeNull()
    expect(defaultHvSettings().weekBSlots.find((s) => s.weekday === 1)?.startHm).toBeNull()
  })

  it('(c) banner constants: inactive vs ready + red', () => {
    expect(HV_ALARM_INACTIVE).toBe("Ton réveil n'est pas actif")
    expect(HV_ALARMS_READY).toBe('Tes réveils sont prêts.')
    expect(HV_RED).toBe('#ff0702')
    expect(HV_IMPOSED_PHRASES).toContain(HV_ALARM_INACTIVE)
    expect(HV_IMPOSED_PHRASES).toContain(HV_ALARMS_READY)
  })
})
