import wave1ManifestJson from '../../assets/exercises/illustrations/wave1/manifest.json'
import wave2ManifestJson from '../../assets/exercises/illustrations/wave2/manifest.json'
import wave3ManifestJson from '../../assets/exercises/illustrations/wave3/manifest.json'
import wave4ManifestJson from '../../assets/exercises/illustrations/wave4/manifest.json'
import developpeCoucheWebp from '../assets/exercises/developpe-couche.webp'

import backSquatPng from '../../assets/exercises/illustrations/wave1/back-squat.png'
import barbellRowPng from '../../assets/exercises/illustrations/wave1/barbell-row.png'
import deadliftPng from '../../assets/exercises/illustrations/wave1/deadlift.png'
import dumbbellBenchPressPng from '../../assets/exercises/illustrations/wave1/dumbbell-bench-press.png'
import dumbbellCurlPng from '../../assets/exercises/illustrations/wave1/dumbbell-curl.png'
import inclineBenchPressPng from '../../assets/exercises/illustrations/wave1/incline-bench-press.png'
import latPulldownPng from '../../assets/exercises/illustrations/wave1/lat-pulldown.png'
import lateralRaisePng from '../../assets/exercises/illustrations/wave1/lateral-raise.png'
import legPressPng from '../../assets/exercises/illustrations/wave1/leg-press.png'
import overheadPressPng from '../../assets/exercises/illustrations/wave1/overhead-press.png'
import pullUpPng from '../../assets/exercises/illustrations/wave1/pull-up.png'
import tricepsPushdownPng from '../../assets/exercises/illustrations/wave1/triceps-pushdown.png'

import arnoldPressPng from '../../assets/exercises/illustrations/wave2/arnold-press.png'
import bulgarianSplitSquatPng from '../../assets/exercises/illustrations/wave2/bulgarian-split-squat.png'
import chestSupportedRowPng from '../../assets/exercises/illustrations/wave2/chest-supported-row.png'
import farmerCarryPng from '../../assets/exercises/illustrations/wave2/farmer-carry.png'
import gobletSquatPng from '../../assets/exercises/illustrations/wave2/goblet-squat.png'
import hammerCurlPng from '../../assets/exercises/illustrations/wave2/hammer-curl.png'
import hangingLegRaisePng from '../../assets/exercises/illustrations/wave2/hanging-leg-raise.png'
import kettlebellSwingPng from '../../assets/exercises/illustrations/wave2/kettlebell-swing.png'

import abWheelPng from '../../assets/exercises/illustrations/wave3/ab-wheel.png'
import chinUpPng from '../../assets/exercises/illustrations/wave3/chin-up.png'
import concentrationCurlPng from '../../assets/exercises/illustrations/wave3/concentration-curl.png'
import overheadTricepsExtensionPng from '../../assets/exercises/illustrations/wave3/overhead-triceps-extension.png'
import rearDeltFlyPng from '../../assets/exercises/illustrations/wave3/rear-delt-fly.png'
import reverseLungePng from '../../assets/exercises/illustrations/wave3/reverse-lunge.png'
import seatedDumbbellPressPng from '../../assets/exercises/illustrations/wave3/seated-dumbbell-press.png'
import sumoDeadliftPng from '../../assets/exercises/illustrations/wave3/sumo-deadlift.png'

import boxSquatPng from '../../assets/exercises/illustrations/wave4/box-squat.png'
import cableKickbackPng from '../../assets/exercises/illustrations/wave4/cable-kickback.png'
import closeGripBenchPng from '../../assets/exercises/illustrations/wave4/close-grip-bench.png'
import goodMorningPng from '../../assets/exercises/illustrations/wave4/good-morning.png'
import inclineDumbbellCurlPng from '../../assets/exercises/illustrations/wave4/incline-dumbbell-curl.png'
import pendlayRowPng from '../../assets/exercises/illustrations/wave4/pendlay-row.png'
import preacherCurlPng from '../../assets/exercises/illustrations/wave4/preacher-curl.png'
import russianTwistPng from '../../assets/exercises/illustrations/wave4/russian-twist.png'

/**
 * Picker / search-result thumbnails only.
 * Do not reuse from immersive session hero — that path stays on `exerciseMedia`.
 */
export const EXERCISE_PICKER_THUMB_PX = 64

const VALIDATED_BENCH_PRESS_UI_ASSET = 'src/assets/exercises/developpe-couche.webp'

type WaveManifestEntry = {
  canonical_id: string
  label: string
  file: string | null
  ui_asset?: string
}

type WaveManifest = {
  entries: Record<string, WaveManifestEntry>
}

/** Bundled PNG URLs keyed by the manifest `file` basename — not by display name. */
const WAVE_PNG_BY_FILE: Record<string, string> = {
  'back-squat.png': backSquatPng,
  'barbell-row.png': barbellRowPng,
  'deadlift.png': deadliftPng,
  'dumbbell-bench-press.png': dumbbellBenchPressPng,
  'dumbbell-curl.png': dumbbellCurlPng,
  'incline-bench-press.png': inclineBenchPressPng,
  'lat-pulldown.png': latPulldownPng,
  'lateral-raise.png': lateralRaisePng,
  'leg-press.png': legPressPng,
  'overhead-press.png': overheadPressPng,
  'pull-up.png': pullUpPng,
  'triceps-pushdown.png': tricepsPushdownPng,
  'arnold-press.png': arnoldPressPng,
  'bulgarian-split-squat.png': bulgarianSplitSquatPng,
  'chest-supported-row.png': chestSupportedRowPng,
  'farmer-carry.png': farmerCarryPng,
  'goblet-squat.png': gobletSquatPng,
  'hammer-curl.png': hammerCurlPng,
  'hanging-leg-raise.png': hangingLegRaisePng,
  'kettlebell-swing.png': kettlebellSwingPng,
  'ab-wheel.png': abWheelPng,
  'chin-up.png': chinUpPng,
  'concentration-curl.png': concentrationCurlPng,
  'overhead-triceps-extension.png': overheadTricepsExtensionPng,
  'rear-delt-fly.png': rearDeltFlyPng,
  'reverse-lunge.png': reverseLungePng,
  'seated-dumbbell-press.png': seatedDumbbellPressPng,
  'sumo-deadlift.png': sumoDeadliftPng,
  'box-squat.png': boxSquatPng,
  'cable-kickback.png': cableKickbackPng,
  'close-grip-bench.png': closeGripBenchPng,
  'good-morning.png': goodMorningPng,
  'incline-dumbbell-curl.png': inclineDumbbellCurlPng,
  'pendlay-row.png': pendlayRowPng,
  'preacher-curl.png': preacherCurlPng,
  'russian-twist.png': russianTwistPng,
}

function illustrationSrcFromEntry(entry: WaveManifestEntry): string | null {
  if (entry.file == null) {
    if (entry.ui_asset === VALIDATED_BENCH_PRESS_UI_ASSET) {
      return developpeCoucheWebp
    }
    return null
  }
  return WAVE_PNG_BY_FILE[entry.file] ?? null
}

/**
 * Built only from wave manifests `entries`.
 * Lookup is an exact canonical id — no slug, no display-name, no hyphen/underscore fold.
 */
function buildSrcByCanonicalId(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const raw of [
    wave1ManifestJson,
    wave2ManifestJson,
    wave3ManifestJson,
    wave4ManifestJson,
  ]) {
    const manifest = raw as WaveManifest
    for (const [key, entry] of Object.entries(manifest.entries)) {
      if (!entry || key !== entry.canonical_id) continue
      const src = illustrationSrcFromEntry(entry)
      if (src) map[entry.canonical_id] = src
    }
  }
  return map
}

const PICKER_ILLUSTRATION_SRC_BY_ID = buildSrcByCanonicalId()

/**
 * Resolve a picker thumbnail URL from an exact catalog canonical id.
 * Unknown / custom / missing file → `null` (neutral fallback). Never fuzzy-matches names.
 */
export function resolvePickerIllustrationSrc(
  canonicalId: string | null | undefined,
): string | null {
  if (typeof canonicalId !== 'string' || canonicalId === '') return null
  return PICKER_ILLUSTRATION_SRC_BY_ID[canonicalId] ?? null
}

export function listPickerIllustrationCanonicalIds(): string[] {
  return Object.keys(PICKER_ILLUSTRATION_SRC_BY_ID)
}
