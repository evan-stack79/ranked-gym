import { describe, expect, it } from 'vitest'
import {
  listFormVideoCanonicalIds,
  resolveFormVideoSrc,
} from './exerciseFormMedia'
import { resolvePickerIllustrationSrc } from './exercisePickerIllustrations'

const WAVE2_IDS = [
  'goblet_squat',
  'bulgarian_split_squat',
  'hammer_curl',
  'arnold_press',
  'hanging_leg_raise',
  'kettlebell_swing',
  'chest_supported_row',
  'farmer_carry',
] as const

describe('exerciseFormMedia', () => {
  it('n’a pas encore de clips — prêt à recevoir les MP4', () => {
    expect(listFormVideoCanonicalIds()).toEqual([])
    for (const id of WAVE2_IDS) {
      expect(resolveFormVideoSrc(id)).toBeNull()
    }
  })

  it('wave2 a déjà l’illustration 3D pour l’aide visuelle', () => {
    for (const id of WAVE2_IDS) {
      expect(resolvePickerIllustrationSrc(id), id).toBeTruthy()
      expect(resolvePickerIllustrationSrc(id)).toMatch(/\.png/i)
    }
  })
})
