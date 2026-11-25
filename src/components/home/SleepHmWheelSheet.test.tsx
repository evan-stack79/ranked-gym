/**
 * @vitest-environment jsdom
 *
 * Reproduit le bug Coucher/Réveil : scroll de la roue (6:55 → 6:15) sans clic
 * sur l’option — Enregistrer doit committer 06:15, pas l’ancien 06:55.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SleepHmWheelSheet } from './SleepHmWheelSheet'
import {
  sleepWheelScrollTopForIndex,
  sleepWheelIndexFromScrollTop,
} from './SleepTimeWheelColumn'
import { getSleepSchedule, saveSleepSchedule } from '../../services/sleepStorage'
import {
  getSleepAlarmSettings,
  saveSleepAlarmSettings,
} from '../../services/sleepAlarmStorage'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
})

vi.mock('../../services/cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('../../services/cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

vi.mock('../../utils/bodyScrollLock', () => ({
  acquireBodyScrollLock: () => () => {},
}))

async function flushSheetOpen() {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  })
}

/**
 * Simule un scroll natif sans onChange React (le bug : snap CSS seul).
 * Ne dispatch PAS `scroll` — l’état React reste sur l’ancienne minute.
 */
function scrollMinuteColumnWithoutReactSync(minute: number) {
  const cols = document.body.querySelectorAll('[data-sleep-wheel-column]')
  const minuteCol = cols[1] as HTMLElement
  expect(minuteCol).toBeTruthy()
  expect(minuteCol.getAttribute('aria-label')).toBe('Minutes')
  minuteCol.scrollTop = sleepWheelScrollTopForIndex(minute)
  expect(sleepWheelIndexFromScrollTop(minuteCol.scrollTop, 60)).toBe(minute)
}

describe('SleepHmWheelSheet scroll → Enregistrer (bug 6:55 → 6:15)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    store.clear()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('Réveil: scroll minutes 55 → 15 puis Enregistrer sauve 06:15', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    act(() => {
      root.render(
        <SleepHmWheelSheet
          open
          onClose={onClose}
          title="Réveil"
          valueHm="06:55"
          onSave={onSave}
        />,
      )
    })
    await flushSheetOpen()

    // Bug repro: scroll visuel sans mise à jour React state → commit via scrollTop.
    scrollMinuteColumnWithoutReactSync(15)

    const saveBtn = document.body.querySelector('[data-sleep-hm-save]') as HTMLButtonElement
    expect(saveBtn).toBeTruthy()
    act(() => {
      saveBtn.click()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('06:15')
    expect(onClose).toHaveBeenCalled()
  })

  it('Coucher: scroll minutes 55 → 15 puis Enregistrer sauve 23:15', async () => {
    const onSave = vi.fn()
    act(() => {
      root.render(
        <SleepHmWheelSheet
          open
          onClose={() => {}}
          title="Coucher"
          valueHm="23:55"
          onSave={onSave}
        />,
      )
    })
    await flushSheetOpen()

    scrollMinuteColumnWithoutReactSync(15)

    act(() => {
      ;(document.body.querySelector('[data-sleep-hm-save]') as HTMLButtonElement).click()
    })

    expect(onSave).toHaveBeenCalledWith('23:15')
  })

  it('Réveil persisté en local + timeHm alarme (6:55 → 6:15)', async () => {
    saveSleepSchedule({ bedtime: '23:00', waketime: '06:55' }, { skipCloud: true })
    saveSleepAlarmSettings({ timeHm: '06:55' })

    act(() => {
      root.render(
        <SleepHmWheelSheet
          open
          onClose={() => {}}
          title="Réveil"
          valueHm="06:55"
          onSave={(hm) => {
            saveSleepSchedule(
              { bedtime: '23:00', waketime: hm },
              { skipCloud: true },
            )
            saveSleepAlarmSettings({ timeHm: hm })
          }}
        />,
      )
    })
    await flushSheetOpen()

    scrollMinuteColumnWithoutReactSync(15)
    act(() => {
      ;(document.body.querySelector('[data-sleep-hm-save]') as HTMLButtonElement).click()
    })

    expect(getSleepSchedule()?.waketime).toBe('06:15')
    expect(getSleepAlarmSettings().timeHm).toBe('06:15')
  })

  it('Coucher persisté en local (23:55 → 23:15)', async () => {
    saveSleepSchedule({ bedtime: '23:55', waketime: '07:00' }, { skipCloud: true })

    act(() => {
      root.render(
        <SleepHmWheelSheet
          open
          onClose={() => {}}
          title="Coucher"
          valueHm="23:55"
          onSave={(hm) => {
            saveSleepSchedule(
              { bedtime: hm, waketime: '07:00' },
              { skipCloud: true },
            )
          }}
        />,
      )
    })
    await flushSheetOpen()

    scrollMinuteColumnWithoutReactSync(15)
    act(() => {
      ;(document.body.querySelector('[data-sleep-hm-save]') as HTMLButtonElement).click()
    })

    expect(getSleepSchedule()?.bedtime).toBe('23:15')
  })
})
