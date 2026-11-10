/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { WaterGoalColumn } from './WaterGoalColumn'
import { WaterReminderBell } from './WaterReminderBell'
import { WaterReminderScheduleSheet } from './WaterReminderScheduleSheet'
import { MSG_GOAL_RANGE, MSG_PERMANENT } from '../../shared/hydration'
import { sanitizeReminderTimes } from '../../services/hydration/hydrationReminders'

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

vi.mock('../../motion/brandPress', () => ({
  pressIn: vi.fn(async () => undefined),
  pressOut: vi.fn(async () => undefined),
}))

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, init?: MouseEventInit) {
      super(type, init)
    }
  }
  ;(globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent
}

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

describe('Réglages Eau B v2 — colonne + cloche', () => {
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

  it('layout : Objectif+valeur sous colonne, cloche shrink-0 à droite, pas de bas-feuille', async () => {
    const onSchedule = vi.fn()
    await act(async () => {
      root.render(
        <div className="flex w-[390px] items-start gap-3" data-hydration-settings-bv2>
          <WaterGoalColumn valueMl={2000} onChange={() => undefined} />
          <WaterReminderBell
            enabled
            times={['10:00', '14:00', '18:00']}
            goalReachedToday={false}
            onChange={() => undefined}
            onOpenSchedule={onSchedule}
          />
        </div>,
      )
    })

    const column = host.querySelector('[data-hydration-goal-column]')
    const bell = host.querySelector('[data-hydration-reminders-bell]')
    expect(column).toBeTruthy()
    expect(bell).toBeTruthy()
    expect(bell?.className).toMatch(/shrink-0/)
    expect(host.textContent).toContain('Objectif')
    expect(host.textContent).toMatch(/2[,.]0\s*L|2\s*L/)
    expect(host.textContent).toContain('Rappels activés')
    expect(host.querySelector('[data-hydration-reminders-schedule-link]')?.textContent).toBe(
      'Horaires',
    )
    // Valeur sous la colonne : le nœud Objectif est dans goal-column, pas dans la cloche.
    expect(column?.textContent).toContain('Objectif')
    expect(bell?.textContent).not.toContain('Objectif')
    expect(bell?.textContent).not.toMatch(/2[,.]0/)
  })

  it('bulle i contient MSG_GOAL_RANGE + messages santé', async () => {
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
    expect(host.textContent).toContain('Rappels coupés')
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

  it('Horaires : max 3 + refuse nuit 21h–8h', async () => {
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
