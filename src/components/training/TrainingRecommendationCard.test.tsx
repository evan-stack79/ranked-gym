/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingRecommendationCard } from './TrainingRecommendationCard'
import type { TrainingRecommendation } from '../../training-engine'

const rec: TrainingRecommendation = {
  slot: 'redo',
  canonicalExerciseId: 'bench_press',
  name: 'Développé couché',
  reasonCode: 'frequent_movement',
  reasonText: 'Parce que tu réalises souvent ce mouvement',
  score: 160,
  durationMin: null,
  imageSrc: null,
}

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

describe('TrainingRecommendationCard', () => {
  it('affiche le nom réel, la justification, et aucun pourcentage inventé', async () => {
    await act(async () => {
      root.render(
        <TrainingRecommendationCard
          recommendation={rec}
          primaryLabel="add"
          onPrimary={vi.fn()}
          onDismiss={vi.fn()}
        />,
      )
    })
    expect(host.textContent).toContain('Développé couché')
    expect(host.textContent).toContain('Parce que tu réalises souvent ce mouvement')
    expect(host.textContent).toContain('Ajouter à ma séance')
    expect(host.textContent).toContain('Pas pour moi')
    expect(host.textContent).not.toMatch(/%/)
    expect(host.textContent).not.toContain('kcal')
    expect(host.querySelector('[data-canonical-exercise="bench_press"]')).toBeTruthy()
    expect(host.querySelector('[data-reco-name]')?.getAttribute('data-reco-name')).toBe(
      'Développé couché',
    )
  })

  it('CTA Commencer avec cet exercice + aide, séries seulement si fournies', async () => {
    await act(async () => {
      root.render(
        <TrainingRecommendationCard
          recommendation={{ ...rec, slot: 'discover', durationMin: null }}
          primaryLabel="start"
          setCount={3}
          onPrimary={vi.fn()}
          onDismiss={vi.fn()}
        />,
      )
    })
    expect(host.textContent).toContain('Commencer avec cet exercice')
    expect(host.textContent).toContain('Tu pourras compléter ta séance ensuite')
    expect(host.textContent).toContain('3 séries')
    expect(host.textContent).not.toContain('12 min')
  })

  it('n’affiche pas de durée ni séries inventées', async () => {
    await act(async () => {
      root.render(
        <TrainingRecommendationCard
          recommendation={{ ...rec, canonicalExerciseId: 'incline_bench_press', name: 'Développé incliné' }}
          primaryLabel="start"
          onPrimary={vi.fn()}
          onDismiss={vi.fn()}
        />,
      )
    })
    expect(host.textContent).toContain('Développé incliné')
    expect(host.querySelector('[data-canonical-exercise="incline_bench_press"]')).toBeTruthy()
    expect(host.textContent).not.toContain('série')
    expect(host.textContent).not.toContain(' min')
  })
})
