/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { LegalDocumentScreen } from './LegalDocumentScreen'

describe('privacy policy OFF photos', () => {
  it('mentionne le chargement des photos Open Food Facts (IP visible)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<LegalDocumentScreen kind="privacy" />)
    })
    const text = host.textContent ?? ''
    expect(text).toContain('Open Food Facts')
    expect(text.toLowerCase()).toMatch(/adresse ip|ip de ton appareil/)
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
