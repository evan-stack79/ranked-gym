/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainWeeklyGoalCard } from './TrainWeeklyGoalCard'
import { weeklyGoalFillRatio } from '../../services/trainWeeklyGoalFill'

describe('TrainWeeklyGoalCard — fill sync', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  async function render(doneCount: number, target: 1 | 2 | 3 | 4 | 5) {
    await act(async () => {
      root.render(
        <TrainWeeklyGoalCard
          doneCount={doneCount}
          target={target}
          sparkShownWeekKey="already-shown"
          onChangeTarget={() => undefined}
          onSparkShown={() => undefined}
        />,
      )
    })
  }

  it('bar data-ratio matches progress text from the same source of truth', async () => {
    await render(1, 2)
    const text = host.querySelector('[data-testid="train-weekly-goal-progress"]')?.textContent
    const fill = host.querySelector('[data-testid="train-weekly-goal-fill"]') as HTMLElement | null
    expect(text).toBe('1/2')
    expect(fill?.getAttribute('data-ratio')).toBe(String(weeklyGoalFillRatio(1, 2)))
    expect(fill?.getAttribute('data-fill-sync')).toBe('1/2')
    expect(fill?.style.transform).toContain(`scaleX(${weeklyGoalFillRatio(1, 2)})`)
  })

  it('remount at 2/2 keeps bar full (no empty flash from transition)', async () => {
    await render(2, 2)
    let fill = host.querySelector('[data-testid="train-weekly-goal-fill"]') as HTMLElement | null
    expect(host.querySelector('[data-testid="train-weekly-goal-progress"]')?.textContent).toBe('2/2')
    expect(fill?.getAttribute('data-ratio')).toBe('1')
    expect(fill?.style.transform).toContain('scaleX(1)')
    expect(fill?.style.transition === 'none' || fill?.style.transition === '').toBe(true)

    // Remount with 0/2 — must snap to empty, not linger at half/full
    await render(0, 2)
    fill = host.querySelector('[data-testid="train-weekly-goal-fill"]') as HTMLElement | null
    expect(host.querySelector('[data-testid="train-weekly-goal-progress"]')?.textContent).toBe('0/2')
    expect(fill?.getAttribute('data-ratio')).toBe('0')
    expect(fill?.style.transform).toContain('scaleX(0)')
  })

  it('fires spark once when reaching 100%', async () => {
    const onSparkShown = vi.fn()
    await act(async () => {
      root.render(
        <TrainWeeklyGoalCard
          doneCount={1}
          target={2}
          sparkShownWeekKey={null}
          onChangeTarget={() => undefined}
          onSparkShown={onSparkShown}
        />,
      )
    })
    expect(host.querySelector('[data-testid="train-weekly-goal-spark"]')).toBeNull()

    await act(async () => {
      root.render(
        <TrainWeeklyGoalCard
          doneCount={2}
          target={2}
          sparkShownWeekKey={null}
          onChangeTarget={() => undefined}
          onSparkShown={onSparkShown}
        />,
      )
    })
    expect(host.querySelector('[data-testid="train-weekly-goal-spark"]')).toBeTruthy()
    expect(onSparkShown).toHaveBeenCalled()
  })
})
