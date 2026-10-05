/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SafetyNote } from './SafetyNote'
import { M_INFO_1, Q8_SCREEN_TITLE } from '../../content/safetyCopy'

describe('SafetyNote', () => {
  it('affiche M_INFO_1 une fois et le lien Besoin d’en parler ?', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let clicked = false
    await act(async () => {
      root.render(
        <SafetyNote
          onNeedToTalk={() => {
            clicked = true
          }}
        />,
      )
    })

    const note = host.querySelector('[data-testid="safety-note"]')
    expect(note?.textContent).toContain(M_INFO_1)
    expect((note?.textContent.match(new RegExp(M_INFO_1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length).toBe(1)
    const link = host.querySelector('[data-testid="dashboard-need-to-talk"]')
    expect(link?.textContent).toContain(Q8_SCREEN_TITLE)
    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(clicked).toBe(true)

    root.unmount()
    host.remove()
  })
})
