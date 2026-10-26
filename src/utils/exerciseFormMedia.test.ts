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

const WAVE3_IDS = [
  'sumo_deadlift',
  'rear_delt_fly',
  'overhead_triceps_extension',
  'seated_dumbbell_press',
  'reverse_lunge',
  'chin_up',
  'concentration_curl',
  'ab_wheel',
] as const

const WAVE4_IDS = [
  'good_morning',
  'cable_kickback',
  'preacher_curl',
  'close_grip_bench',
  'pendlay_row',
  'box_squat',
  'incline_dumbbell_curl',
  'russian_twist',
] as const

const WAVE5_IDS = [
  't_bar_row',
  'hack_squat',
  'shrug',
  'cable_crunch',
  'nordic_curl',
  'landmine_press',
  'step_up',
  'dragon_flag',
] as const

describe('exerciseFormMedia', () => {
  it('n’a pas encore de clips — prêt à recevoir les MP4', () => {
    expect(listFormVideoCanonicalIds()).toEqual([])
    for (const id of [...WAVE2_IDS, ...WAVE3_IDS, ...WAVE4_IDS, ...WAVE5_IDS]) {
      expect(resolveFormVideoSrc(id)).toBeNull()
    }
  })

  it('wave2/wave3/wave4/wave5 ont déjà l’illustration 3D pour l’aide visuelle', () => {
    for (const id of [...WAVE2_IDS, ...WAVE3_IDS, ...WAVE4_IDS, ...WAVE5_IDS]) {
      expect(resolvePickerIllustrationSrc(id), id).toBeTruthy()
      expect(resolvePickerIllustrationSrc(id)).toMatch(/\.png/i)
    }
  })
})
