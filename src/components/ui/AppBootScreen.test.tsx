/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { AppBootScreen } from './AppBootScreen'

describe('AppBootScreen', () => {
  it('n’affiche aucun copy technique pendant la restauration', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<AppBootScreen />)
    })
    expect(host.querySelector('[data-session-restore]')).toBeTruthy()
    expect(host.getAttribute('aria-label') || host.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'Ranked Gym',
    )
    expect(host.textContent).not.toContain('Chargement')
    expect(host.textContent).not.toContain('Récupération')
    expect(host.textContent).not.toContain('VITE_')
    expect(host.textContent).not.toContain('Supabase')
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
