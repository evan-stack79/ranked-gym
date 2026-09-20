import { describe, expect, it } from 'vitest'
import wave1ManifestJson from '../../assets/exercises/illustrations/wave1/manifest.json'
import { resolveExerciseMedia } from './exerciseMedia'
import { resolvePickerIllustrationSrc } from './exercisePickerIllustrations'

type Wave1Entry = {
  canonical_id: string
  file: string | null
  ui_asset?: string
}

const WAVE1_ENTRIES = (wave1ManifestJson as { entries: Record<string, Wave1Entry> }).entries

const WAVE1_PNG_IDS = [
  'incline_bench_press',
  'dumbbell_bench_press',
  'overhead_press',
  'back_squat',
  'deadlift',
  'leg_press',
  'barbell_row',
  'pull_up',
  'lat_pulldown',
  'dumbbell_curl',
  'triceps_pushdown',
  'lateral_raise',
] as const

describe('resolvePickerIllustrationSrc', () => {
  it('associe les 12 ids wave1 au fichier manifeste (id exact)', () => {
    expect(WAVE1_PNG_IDS).toHaveLength(12)
    for (const id of WAVE1_PNG_IDS) {
      const entry = WAVE1_ENTRIES[id]
      expect(entry?.canonical_id).toBe(id)
      expect(entry?.file).toMatch(/\.png$/)
      const src = resolvePickerIllustrationSrc(id)
      expect(src, id).toBeTruthy()
      const stem = entry.file!.replace(/\.png$/i, '')
      expect(src).toMatch(new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    }
  })

  it('bench_press → asset webp validé, jamais une PNG wave1', () => {
    const entry = WAVE1_ENTRIES.bench_press
    expect(entry.file).toBeNull()
    expect(entry.ui_asset).toBe('src/assets/exercises/developpe-couche.webp')
    const src = resolvePickerIllustrationSrc('bench_press')
    expect(src).toBeTruthy()
    expect(src).toMatch(/developpe-couche/i)
    expect(src).not.toMatch(/wave1/i)
    expect(src).not.toMatch(/\.png(\?|$)/i)
  })

  it('id inconnu → null (fallback neutre)', () => {
    expect(resolvePickerIllustrationSrc('unknown_move_xyz')).toBeNull()
    expect(resolvePickerIllustrationSrc('not_in_catalog')).toBeNull()
  })

  it('exercice personnalisé / id absent → null', () => {
    expect(resolvePickerIllustrationSrc(null)).toBeNull()
    expect(resolvePickerIllustrationSrc(undefined)).toBeNull()
    expect(resolvePickerIllustrationSrc('')).toBeNull()
  })

  it('ne déduit jamais l’image depuis un nom libre ou un fuzzy', () => {
    expect(resolvePickerIllustrationSrc('Développé couché')).toBeNull()
    expect(resolvePickerIllustrationSrc('developpe-couche')).toBeNull()
    expect(resolvePickerIllustrationSrc('bench-press')).toBeNull()
    expect(resolvePickerIllustrationSrc('bench')).toBeNull()
    expect(resolvePickerIllustrationSrc('Deadlift')).toBeNull()
    expect(resolvePickerIllustrationSrc('deadlift ')).toBeNull()
    expect(resolvePickerIllustrationSrc('souleve-de-terre')).toBeNull()
    expect(resolvePickerIllustrationSrc('pull-up')).toBeNull()
    expect(resolvePickerIllustrationSrc('BENCH_PRESS')).toBeNull()
  })
})

describe('exerciseMedia immersive no-reg', () => {
  it('ne branche pas les PNG wave1 sur le hero séance', () => {
    for (const id of WAVE1_PNG_IDS) {
      expect(resolveExerciseMedia({ canonicalExerciseId: id }).imageSrc).toBeNull()
    }
  })

  it('conserve le webp validé uniquement pour bench_press', () => {
    const media = resolveExerciseMedia({ canonicalExerciseId: 'bench_press' })
    expect(media.imageSrc).toMatch(/developpe-couche/i)
    expect(media.imageSrc).not.toMatch(/\.png(\?|$)/i)
  })
})
