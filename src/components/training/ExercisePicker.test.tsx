/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act, type ComponentProps } from 'react'
import { ExercisePicker } from './ExercisePicker'
import { EXERCISE_PICKER_THUMB_PX } from '../../utils/exercisePickerIllustrations'

async function renderPicker(props: Partial<ComponentProps<typeof ExercisePicker>> = {}) {
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
        {...props}
      />,
    )
  })
  return {
    host,
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

async function typeSearch(host: HTMLElement, value: string) {
  const input = host.querySelector('input[type="search"]') as HTMLInputElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

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
    expect(host.textContent).toContain('+ Créer un exercice personnalisé')
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
    expect(host.textContent).toContain('Choisis un mouvement à ajouter.')
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

  it('miniatures 64px à gauche : wave1 + bench_press webp, fallback sinon', async () => {
    const { host, cleanup } = await renderPicker()

    const bench = host.querySelector('[data-exercise-id="bench_press"]')
    const benchThumb = bench?.querySelector('[data-picker-thumb]') as HTMLElement | null
    expect(benchThumb?.getAttribute('data-picker-thumb-state')).toBe('illustration')
    expect(benchThumb?.style.width).toBe(`${EXERCISE_PICKER_THUMB_PX}px`)
    expect(benchThumb?.style.height).toBe(`${EXERCISE_PICKER_THUMB_PX}px`)
    const benchImg = bench?.querySelector('img') as HTMLImageElement | null
    expect(benchImg?.getAttribute('src')).toMatch(/developpe-couche/i)
    expect(benchImg?.className).toMatch(/object-contain/)

    const squat = host.querySelector('[data-exercise-id="back_squat"]')
    expect(squat?.querySelector('[data-picker-thumb-state="illustration"]')).toBeTruthy()
    expect(squat?.querySelector('img')?.getAttribute('src')).toMatch(/back-squat/i)

    const deadlift = host.querySelector('[data-exercise-id="deadlift"]')
    expect(deadlift?.querySelector('img')?.getAttribute('src')).toMatch(/deadlift/i)

    await cleanup()
  })

  it('recherche « développé » : plusieurs résultats illustrés, pas de fuzzy name', async () => {
    const { host, cleanup } = await renderPicker()
    await typeSearch(host, 'développé')

    const ids = [...host.querySelectorAll('[data-exercise-id]')].map((el) =>
      el.getAttribute('data-exercise-id'),
    )
    expect(ids).toContain('bench_press')
    expect(ids).toContain('incline_bench_press')
    expect(ids).toContain('dumbbell_bench_press')
    expect(ids).toContain('overhead_press')

    expect(
      host
        .querySelector('[data-exercise-id="incline_bench_press"] img')
        ?.getAttribute('src'),
    ).toMatch(/incline-bench-press/i)
    expect(
      host
        .querySelector('[data-exercise-id="dumbbell_bench_press"] img')
        ?.getAttribute('src'),
    ).toMatch(/dumbbell-bench-press/i)
    expect(
      host.querySelector('[data-exercise-id="overhead_press"] img')?.getAttribute('src'),
    ).toMatch(/overhead-press/i)

    await cleanup()
  })

  it('id sans illustration + exo custom : fallback neutre uniquement', async () => {
    const onCreateCustom = vi.fn()
    const { host, cleanup } = await renderPicker({ onCreateCustom })
    await typeSearch(host, 'planche')

    const plank = host.querySelector('[data-exercise-id="plank"]')
    expect(plank).toBeTruthy()
    expect(plank?.querySelector('[data-picker-thumb-state="fallback"]')).toBeTruthy()
    expect(plank?.querySelector('img')).toBeNull()
    expect(plank?.querySelector('[data-picker-thumb-fallback]')).toBeTruthy()

    await act(async () => {
      const createBtn = [...host.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Créer un exercice personnalisé'),
      )
      createBtn?.click()
    })
    const customInput = host.querySelector(
      'input[placeholder="Nom de ton exercice"]',
    ) as HTMLInputElement
    expect(customInput.value).toBe('planche')
    expect(host.querySelector('[data-picker-thumb-state="illustration"]')).toBeNull()

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(customInput, 'Développé couché')
      customInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      const submit = [...host.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Créer et ajouter'),
      )
      submit?.click()
    })
    expect(onCreateCustom).toHaveBeenCalledWith('Développé couché')

    await cleanup()
  })
})
