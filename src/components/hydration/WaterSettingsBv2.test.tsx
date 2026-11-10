/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { WaterGoalColumn } from './WaterGoalColumn'
import { WaterReminderBell } from './WaterReminderBell'
import { WaterReminderScheduleSheet } from './WaterReminderScheduleSheet'
import { WaterContainerCarousel } from './WaterContainerCarousel'
import { MSG_GOAL_RANGE, MSG_PERMANENT } from '../../shared/hydration'
import { sanitizeReminderTimes } from '../../services/hydration/hydrationReminders'

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

vi.mock('../../motion/brandPress', () => ({
  pressIn: vi.fn(async () => undefined),
  pressOut: vi.fn(async () => undefined),
}))

vi.mock('../../services/hydration/hydrationReminders', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/hydration/hydrationReminders')
  >('../../services/hydration/hydrationReminders')
  return {
    ...actual,
    syncHydrationReminders: vi.fn(async ({ enabled }: { enabled: boolean }) => ({
      ok: true as const,
      enabled,
    })),
  }
})

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, init?: MouseEventInit) {
      super(type, init)
    }
  }
  ;(globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent
}

describe('Réglages Eau B v2 — layout + cloche ligne', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
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

  it('4 tuiles entières + Objectif centré + ligne Rappels (pas de cloche isolée)', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      root.render(
        <div className="w-[390px]" data-hydration-settings-bv2>
          <WaterContainerCarousel
            mode="classic_2l"
            proActive={false}
            onSelect={onSelect}
            onRequestPro={() => undefined}
          />
          <WaterGoalColumn valueMl={2000} onChange={() => undefined} />
          <WaterReminderBell
            enabled
            times={['10:00', '14:00', '18:00']}
            goalReachedToday={false}
            onChange={() => undefined}
            onOpenSchedule={() => undefined}
          />
        </div>,
      )
    })

    const tiles = host.querySelectorAll('[data-hydration-carousel-tile]')
    expect(tiles.length).toBe(4)
    expect(host.querySelector('[data-hydration-goal-column]')?.className).toMatch(/items-center/)
    expect(host.textContent).toContain('Objectif')
    expect(host.textContent).toContain('Rappels')
    expect(host.querySelector('[data-hydration-reminders-status]')?.textContent).toMatch(/activés/)
    expect(host.querySelector('[data-hydration-reminders-schedule-link]')?.textContent).toBe(
      'Horaires',
    )
    // Pas de grosse cloche isolée à droite
    const bell = host.querySelector('[data-hydration-reminders-toggle]')
    expect(bell?.className).toMatch(/h-11/)
    expect(host.textContent).not.toContain('Eau bue seule')

    await act(async () => {
      ;(host.querySelector('[data-hydration-carousel-tile="classic_15"]') as HTMLButtonElement).click()
    })
    expect(onSelect).toHaveBeenCalledWith('classic_15')
  })

  it('bulle i contient MSG_GOAL_RANGE + messages santé (eau seule)', async () => {
    await act(async () => {
      root.render(<WaterGoalColumn valueMl={1500} onChange={() => undefined} />)
    })
    const info = host.querySelector('[data-hydration-goal-info]') as HTMLButtonElement
    await act(async () => {
      info.click()
    })
    const bubble = host.querySelector('[data-hydration-goal-info-bubble]')
    expect(bubble?.textContent).toContain(MSG_GOAL_RANGE)
    expect(bubble?.textContent).toContain(MSG_PERMANENT)
  })

  it('cloche : tap toggle + lien Horaires', async () => {
    const onChange = vi.fn()
    const onSchedule = vi.fn()
    await act(async () => {
      root.render(
        <WaterReminderBell
          enabled={false}
          times={['10:00']}
          goalReachedToday={false}
          onChange={onChange}
          onOpenSchedule={onSchedule}
        />,
      )
    })
    expect(host.textContent).toContain('coupés')
    const toggle = host.querySelector('[data-hydration-reminders-toggle]') as HTMLButtonElement
    await act(async () => {
      toggle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      toggle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      await Promise.resolve()
    })
    expect(onChange).toHaveBeenCalled()
    const link = host.querySelector('[data-hydration-reminders-schedule-link]') as HTMLButtonElement
    await act(async () => {
      link.click()
    })
    expect(onSchedule).toHaveBeenCalled()
  })

  it('Horaires : max 3 + reject nuit 21h–8h', async () => {
    expect(sanitizeReminderTimes(['10:00', '14:00', '18:00', '19:00'])).toEqual([
      '10:00',
      '14:00',
      '18:00',
    ])
    expect(sanitizeReminderTimes(['22:00', '07:00', '10:00'])).toEqual(['10:00'])

    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <WaterReminderScheduleSheet
          open
          times={['10:00', '14:00', '18:00']}
          onClose={() => undefined}
          onSave={onSave}
        />,
      )
    })
    expect(host.querySelectorAll('[data-hydration-reminder-slot]').length).toBeLessThanOrEqual(3)
  })
})
