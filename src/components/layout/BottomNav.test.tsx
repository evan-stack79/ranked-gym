/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('BottomNav centre', () => {
  it('Nouvelle séance s’il n’y a pas de brouillon', async () => {
    await act(async () => {
      root.render(
        <BottomNav activeTab="training" onTabChange={vi.fn()} hasActiveWorkout={false} />,
      )
    })
    expect(host.textContent).toContain('Nouvelle séance')
    expect(host.querySelector('[data-nav-center="new"]')).toBeTruthy()
    expect(host.textContent).not.toContain('Démarrer')
  })

  it('Reprendre si une séance est active', async () => {
    await act(async () => {
      root.render(
        <BottomNav activeTab="training" onTabChange={vi.fn()} hasActiveWorkout />,
      )
    })
    expect(host.textContent).toContain('Reprendre')
    expect(host.querySelector('[data-nav-center="resume"]')).toBeTruthy()
    expect(host.textContent).not.toContain('Nouvelle séance')
  })
})
