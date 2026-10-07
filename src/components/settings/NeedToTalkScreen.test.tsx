import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NeedToTalkScreen } from './NeedToTalkScreen'
import {
  M_INFO_1,
  Q8_ECRAN_ORIENTATION,
  TCA_PHONE_TEL,
  TCA_RESOURCE_LINKS,
} from '../../content/safetyCopy'

describe('NeedToTalkScreen', () => {
  it('rend les textes verbatim et liens tel:', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NeedToTalkScreen onBack={() => undefined} />)
    })

    const verbatim = host.querySelector('[data-testid="q8-verbatim"]')
    expect(verbatim?.textContent).toBe(Q8_ECRAN_ORIENTATION)
    expect(host.querySelector(`a[href="${TCA_PHONE_TEL.anorexieBoulimie}"]`)).toBeTruthy()
    expect(host.querySelector(`a[href="${TCA_PHONE_TEL.filSanteJeunes}"]`)).toBeTruthy()
    expect(host.querySelector(`a[href="${TCA_PHONE_TEL.detresse}"]`)).toBeTruthy()
    expect(host.querySelector(`a[href="${TCA_PHONE_TEL.urgence}"]`)).toBeTruthy()
    expect(host.textContent).toMatch(/15 \(ou le 112\)/)
    expect(host.textContent).not.toContain('0 810 037 037')
    const ffab = host.querySelector(`a[href="${TCA_RESOURCE_LINKS.ffabAnnuaire}"]`)
    expect(ffab?.getAttribute('target')).toBe('_blank')
    expect(ffab?.getAttribute('rel')).toContain('noopener')

    root.unmount()
    host.remove()
  })

  it('n’affiche pas le bandeau M_INFO_1 (écran d’orientation, pas de doublon)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NeedToTalkScreen onBack={() => undefined} />)
    })

    expect(host.textContent).not.toContain(M_INFO_1)
    expect(host.querySelector('[data-testid="safety-note"]')).toBeNull()
    expect(host.querySelector('[data-testid="calorie-goal-disabled-notice"]')).toBeNull()

    root.unmount()
    host.remove()
  })
})
