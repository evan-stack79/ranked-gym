/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { ExercisePicker } from './ExercisePicker'

describe('ExercisePicker', () => {
  it('affiche le titre exact au démarrage et jamais « Séance libre »', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <ExercisePicker
          mode="first"
          onBack={() => undefined}
          onSelect={() => undefined}
          onCreateCustom={() => undefined}
        />,
      )
    })

    expect(host.textContent).toContain('Quel est ton premier exercice ?')
    expect(host.textContent).toContain('Choisis un mouvement pour commencer.')
    expect(host.textContent).not.toContain('Séance libre')
    expect(host.querySelector('[data-exercise-picker]')).toBeTruthy()
    expect(host.textContent).toMatch(/\d+ résultats?/)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('mode + : titre Ajouter un exercice', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <ExercisePicker
          mode="add"
          onBack={() => undefined}
          onSelect={() => undefined}
          onCreateCustom={() => undefined}
        />,
      )
    })
    expect(host.textContent).toContain('Ajouter un exercice')
    expect(host.textContent).not.toContain('Séance libre')
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('sélection catalogue appelle onSelect avec id canonique', async () => {
    const onSelect = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <ExercisePicker
          mode="first"
          onBack={() => undefined}
          onSelect={onSelect}
          onCreateCustom={() => undefined}
        />,
      )
    })

    // Sans requête : top popularité → bench_press en tête (indicateur actif).
    const bench = host.querySelector('[data-exercise-id="bench_press"]') as HTMLButtonElement | null
    expect(bench).toBeTruthy()
    expect(bench?.getAttribute('data-result-active')).toBe('true')
    await act(async () => {
      bench?.click()
    })
    expect(onSelect).toHaveBeenCalled()
    expect(onSelect.mock.calls[0][0].id).toBe('bench_press')
    expect(onSelect.mock.calls[0][0].name).toBe('Développé couché')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
