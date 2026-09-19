import { describe, expect, it, vi } from 'vitest'
import {
  SESSION_HISTORY_KEY,
  isSessionHistoryState,
  popSessionHistoryIfNeeded,
  pushSessionHistory,
  replaceHubHistory,
  shouldAutoReopenSession,
} from './sessionBackNav'

function mockHistory(initialState: unknown = null) {
  let state = initialState
  const history = {
    get state() {
      return state
    },
    pushState: vi.fn((_s: unknown, _t: string) => {
      state = _s
    }),
    replaceState: vi.fn((_s: unknown, _t: string) => {
      state = _s
    }),
    back: vi.fn(() => {
      state = null
    }),
  }
  return history as unknown as History & {
    pushState: ReturnType<typeof vi.fn>
    replaceState: ReturnType<typeof vi.fn>
    back: ReturnType<typeof vi.fn>
  }
}

describe('sessionBackNav', () => {
  it('pushSessionHistory n’ajoute qu’une entrée séance', () => {
    const history = mockHistory(null)
    pushSessionHistory(history)
    pushSessionHistory(history)
    expect(history.pushState).toHaveBeenCalledTimes(1)
    expect(isSessionHistoryState(history.state)).toBe(true)
  })

  it('popSessionHistoryIfNeeded appelle back seulement si entrée séance', () => {
    const withSession = mockHistory({ [SESSION_HISTORY_KEY]: true })
    expect(popSessionHistoryIfNeeded(withSession)).toBe(true)
    expect(withSession.back).toHaveBeenCalledTimes(1)

    const empty = mockHistory(null)
    expect(popSessionHistoryIfNeeded(empty)).toBe(false)
    expect(empty.back).not.toHaveBeenCalled()
  })

  it('replaceHubHistory retire le marqueur sans back', () => {
    const history = mockHistory({ [SESSION_HISTORY_KEY]: true, other: 1 })
    replaceHubHistory(history)
    expect(history.replaceState).toHaveBeenCalledTimes(1)
    expect(isSessionHistoryState(history.state)).toBe(false)
  })

  it('shouldAutoReopenSession : voluntary hub → non ; cold start → oui', () => {
    expect(
      shouldAutoReopenSession({
        hasActiveDraft: true,
        lastVoluntaryRoute: 'train-hub',
      }),
    ).toBe(false)
    expect(
      shouldAutoReopenSession({
        hasActiveDraft: true,
        lastVoluntaryRoute: null,
      }),
    ).toBe(true)
    expect(
      shouldAutoReopenSession({
        hasActiveDraft: false,
        lastVoluntaryRoute: null,
      }),
    ).toBe(false)
  })

  it('non-régression soft-leave : hub volontaire ne réouvre pas même si draft actif', () => {
    // Contrat #42 — ne pas casser Reprendre / bandeau.
    expect(
      shouldAutoReopenSession({
        hasActiveDraft: true,
        lastVoluntaryRoute: 'train-hub',
      }),
    ).toBe(false)
  })
})
