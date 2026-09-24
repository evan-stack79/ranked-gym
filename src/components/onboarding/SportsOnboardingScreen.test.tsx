/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SportsOnboardingScreen } from './SportsOnboardingScreen'
import { SportsMultiSelect } from './SportsMultiSelect'

const setTrainingSports = vi.fn()

vi.mock('../../services/trainingStorage', () => ({
  getTrainingState: () => ({
    favoriteSportIds: [],
    sportsUndecided: false,
    sportsOnboardingComplete: false,
  }),
  setTrainingSports: (...args: unknown[]) => setTrainingSports(...args),
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  setTrainingSports.mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('SportsOnboardingScreen', () => {
  it('simple : un sport suffit pour continuer', async () => {
    const onComplete = vi.fn()
    await act(async () => {
      root.render(<SportsOnboardingScreen onComplete={onComplete} />)
    })
    expect(host.textContent).toContain('Quels sports pratiques-tu ou aimerais-tu commencer')
    const continueBtn = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')
    expect(continueBtn).toBeTruthy()
    expect(continueBtn).toHaveProperty('disabled', true)

    const muscu = [...host.querySelectorAll('[role="option"]')].find((el) =>
      el.textContent?.includes('Musculation'),
    )
    expect(muscu).toBeTruthy()
    expect(muscu?.getAttribute('aria-selected')).toBe('false')
    await act(async () => {
      muscu!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(muscu?.getAttribute('aria-selected')).toBe('true')
    expect(continueBtn).toHaveProperty('disabled', false)
    await act(async () => {
      continueBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(setTrainingSports).toHaveBeenCalledWith(expect.arrayContaining(['musculation']), {
      undecided: false,
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('multi-select, recherche, suppression et Je ne sais pas encore', async () => {
    const onComplete = vi.fn()
    await act(async () => {
      root.render(<SportsOnboardingScreen onComplete={onComplete} />)
    })
    const tennis = host.querySelector('#sport-tennis') as HTMLButtonElement | null
    const foot = host.querySelector('#sport-football') as HTMLButtonElement | null
    expect(tennis).toBeTruthy()
    expect(foot).toBeTruthy()
    await act(async () => {
      tennis!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      foot!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const chips = host.querySelector('[aria-label="Sports sélectionnés"]')?.textContent ?? ''
    expect(chips).toMatch(/Tennis/)
    expect(chips).toMatch(/Football/)

    const options = () => [...host.querySelectorAll('[role="option"]')]

    const search = host.querySelector('input[aria-label="Rechercher un sport"]') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(search, 'yoga')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(options().some((el) => /yoga/i.test(el.textContent ?? ''))).toBe(true)
    expect(options().every((el) => /yoga/i.test(el.textContent ?? ''))).toBe(true)

    const list = host.querySelector('[role="listbox"]') as HTMLElement
    expect(list.className).toMatch(/overflow-y-auto/)

    await act(async () => {
      host
        .querySelector('[aria-label="Retirer Tennis"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[aria-label="Retirer Tennis"]')).toBeNull()

    const skip = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Je ne sais pas encore',
    )
    await act(async () => {
      skip!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(setTrainingSports).toHaveBeenCalledWith([], { undecided: true })
    expect(onComplete).toHaveBeenCalled()
  })
})

describe('SportsMultiSelect a11y', () => {
  it('listbox multi-select + options clavier / SR', async () => {
    await act(async () => {
      root.render(<SportsMultiSelect selectedIds={[]} onChange={vi.fn()} />)
    })
    const list = host.querySelector('[role="listbox"]')
    expect(list?.getAttribute('aria-multiselectable')).toBe('true')
    const option = host.querySelector('[role="option"]') as HTMLButtonElement
    expect(option.tagName).toBe('BUTTON')
    expect(option.getAttribute('aria-selected')).toBe('false')
  })
})
