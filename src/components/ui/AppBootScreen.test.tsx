/** @vitest-environment jsdom */
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppBootScreen } from './AppBootScreen'
import { containsForbiddenBootCopy, USER_BOOT_ARIA_LABEL } from '../../boot/bootUiCopy'

describe('AppBootScreen', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('affiche un splash Ranked Gym sobre sans texte technique ni spinner central', () => {
    act(() => {
      root.render(
        <StrictMode>
          <AppBootScreen />
        </StrictMode>,
      )
    })

    const screen = host.querySelector('[data-app-boot-screen="1"]')
    expect(screen).not.toBeNull()
    expect(screen?.getAttribute('aria-label')).toBe(USER_BOOT_ARIA_LABEL)
    expect(host.querySelector('[data-home-boot-skeleton="1"]')).not.toBeNull()
    expect(host.querySelector('.animate-spin')).toBeNull()
    expect(containsForbiddenBootCopy(host.textContent ?? '')).toBeNull()
    expect(host.textContent).toContain('Ranked')
    expect(host.textContent).toContain('Gym')
    expect(host.textContent ?? '').not.toMatch(/Convex|Supabase|storage|hydrat/i)
  })
})
