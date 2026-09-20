import wave1ManifestJson from '../../assets/exercises/illustrations/wave1/manifest.json'
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

/**
 * Picker / search-result thumbnails only.
 * Do not reuse from immersive session hero — that path stays on `exerciseMedia`.
 */
export const EXERCISE_PICKER_THUMB_PX = 64

const VALIDATED_BENCH_PRESS_UI_ASSET = 'src/assets/exercises/developpe-couche.webp'

type Wave1ManifestEntry = {
  canonical_id: string
  label: string
  file: string | null
  ui_asset?: string
}

type Wave1Manifest = {
  entries: Record<string, Wave1ManifestEntry>
}

/** Bundled PNG URLs keyed by the manifest `file` basename — not by display name. */
const WAVE1_PNG_BY_FILE: Record<string, string> = {
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
}

function illustrationSrcFromEntry(entry: Wave1ManifestEntry): string | null {
  if (entry.file == null) {
    if (entry.ui_asset === VALIDATED_BENCH_PRESS_UI_ASSET) {
      return developpeCoucheWebp
    }
    return null
  }
  return WAVE1_PNG_BY_FILE[entry.file] ?? null
}

/**
 * Built only from `manifest.json` `entries`.
 * Lookup is an exact canonical id — no slug, no display-name, no hyphen/underscore fold.
 */
function buildSrcByCanonicalId(): Record<string, string> {
  const manifest = wave1ManifestJson as Wave1Manifest
  const map: Record<string, string> = {}
  for (const [key, entry] of Object.entries(manifest.entries)) {
    if (!entry || key !== entry.canonical_id) continue
    const src = illustrationSrcFromEntry(entry)
    if (src) map[entry.canonical_id] = src
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
