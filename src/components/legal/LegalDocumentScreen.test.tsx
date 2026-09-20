/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { LegalDocumentScreen } from './LegalDocumentScreen'
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH, legalKindFromPath } from './legalRoutes'

describe('legal routes', () => {
  it('mappe les chemins existants', () => {
    expect(legalKindFromPath(LEGAL_TERMS_PATH)).toBe('terms')
    expect(legalKindFromPath(LEGAL_PRIVACY_PATH)).toBe('privacy')
    expect(legalKindFromPath('/')).toBeNull()
  })

  it('rend des documents cliquables', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<LegalDocumentScreen kind="terms" />)
    })
    expect(host.querySelector('[data-legal-document="terms"]')).toBeTruthy()
    expect(host.textContent).toContain('Conditions d’utilisation')
    expect(host.querySelector(`a[href="${LEGAL_PRIVACY_PATH}"]`)).toBeTruthy()
    expect(host.querySelector('a[href="/"]')?.textContent).toContain('Retour')
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
