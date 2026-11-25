/**
 * @vitest-environment jsdom
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuthContextValue } from '../../test/authFixtureValue'

const manageSubscriptions = vi.fn(async () => undefined)

vi.mock('../../native/purchases', () => ({
  getPurchasesAdapter: () => ({ manageSubscriptions }),
}))

vi.mock('./YourDataMealsEraseCard', () => ({
  YourDataMealsEraseCard: () => null,
}))

vi.mock('../../context/AuthContext', async () => {
  const { buildAuthContextValue: build } = await import('../../test/authFixtureValue')
  return {
    useAuth: () =>
      build({
        user: {
          id: 'user-sec',
          email: 'sec@example.com',
          displayName: 'Sec',
          provider: 'email',
        },
        isAuthenticated: true,
      }),
  }
})

import {
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_JURISTE_WARNING,
  ACCOUNT_DELETE_MANAGE_SUBSCRIPTION_LABEL,
  SecurityScreen,
} from './SecurityScreen'

describe('SecurityScreen account deletion copy', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    manageSubscriptions.mockClear()
    void buildAuthContextValue
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('shows the Juriste warning, manage-subscription control, and forever-delete label', async () => {
    await act(async () => {
      root.render(
        <SecurityScreen
          onBack={() => undefined}
          ghostModeEnabled={false}
          onGhostModeChange={() => undefined}
          onSignOut={() => undefined}
        />,
      )
    })

    const openDelete = Array.from(host.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Supprimer mon compte',
    )
    expect(openDelete).toBeTruthy()
    await act(async () => {
      openDelete?.click()
    })

    expect(document.body.textContent).toContain(ACCOUNT_DELETE_JURISTE_WARNING)
    expect(document.body.textContent).toContain(ACCOUNT_DELETE_MANAGE_SUBSCRIPTION_LABEL)
    expect(document.body.textContent).toContain(ACCOUNT_DELETE_CONFIRM_LABEL)
    expect(document.body.textContent).not.toContain('Supprimer définitivement')

    const manage = document.body.querySelector(
      '[data-testid="account-delete-manage-subscription"]',
    ) as HTMLButtonElement
    expect(manage).toBeTruthy()
    await act(async () => {
      manage.click()
    })
    expect(manageSubscriptions).toHaveBeenCalledTimes(1)
  })
})
