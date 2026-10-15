/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SUPPORT_EMAIL, WRITE_TO_US_LABEL } from '../../config/contact'
import { ContactUsBlock } from './ContactUsBlock'

describe('ContactUsBlock', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('affiche le message, le bouton Nous écrire, et l’adresse en texte sélectionnable', () => {
    act(() => {
      root.render(<ContactUsBlock message="Pour corriger ton âge, écris-nous." testIdPrefix="age-contact" />)
    })
    expect(container.querySelector('[data-testid="age-contact-message"]')?.textContent).toBe(
      'Pour corriger ton âge, écris-nous.',
    )
    expect(container.querySelector('[data-testid="age-contact-write-btn"]')?.textContent).toBe(
      WRITE_TO_US_LABEL,
    )
    const address = container.querySelector('[data-testid="age-contact-address"]') as HTMLElement
    expect(address).toBeTruthy()
    // SUPPORT_EMAIL vide → message bientôt disponible (texte copiable)
    expect(address.textContent).toBe(SUPPORT_EMAIL)
    expect(address.style.userSelect || getComputedStyle(address).userSelect).toMatch(/text|all|auto/)
  })
})
