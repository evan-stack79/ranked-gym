/**
 * @vitest-environment jsdom
 * SUPPORT_EMAIL vide → message bientôt disponible (pas de mailto).
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../config/contact', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/contact')>()
  return {
    ...actual,
    SUPPORT_EMAIL: '',
  }
})

describe('ContactUsBlock — SUPPORT_EMAIL vide', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('affiche CONTACT_UNAVAILABLE_MESSAGE', async () => {
    const { CONTACT_UNAVAILABLE_MESSAGE, WRITE_TO_US_LABEL } = await import('../../config/contact')
    const { ContactUsBlock } = await import('./ContactUsBlock')

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    act(() => {
      root.render(<ContactUsBlock message="Pour corriger ton âge." testIdPrefix="empty-contact" />)
    })

    expect(host.querySelector('[data-testid="empty-contact-write-btn"]')?.textContent).toBe(
      WRITE_TO_US_LABEL,
    )
    expect(host.querySelector('[data-testid="empty-contact-address"]')?.textContent).toBe(
      CONTACT_UNAVAILABLE_MESSAGE,
    )

    act(() => {
      root.unmount()
    })
    host.remove()
  })
})
