import { useMemo, useState } from 'react'
import { HeightWeightPicker } from '../components/common/HeightWeightPicker'

type Mode = 'empty' | 'weight' | 'height' | 'lb' | 'noted' | 'erase'

function modeFromQuery(): Mode {
  if (typeof window === 'undefined') return 'empty'
  const m = new URLSearchParams(window.location.search).get('mode')
  if (m === 'weight' || m === 'height' || m === 'lb' || m === 'noted' || m === 'erase') return m
  return 'empty'
}

/**
 * Route `/height-weight-fixture` — captures roue taille/poids (iPhone) sans auth.
 * Query `?mode=empty|weight|height|lb|noted|erase`
 */
export function HeightWeightFixture() {
  const initialMode = useMemo(() => modeFromQuery(), [])
  const [weightKg, setWeightKg] = useState<number | null>(() =>
    initialMode === 'empty' || initialMode === 'noted' ? null : 72,
  )
  const [heightCm, setHeightCm] = useState<number | null>(() =>
    initialMode === 'empty' ? null : 175,
  )
  const [noted, setNoted] = useState(initialMode === 'noted')
  const [unitPref, setUnitPref] = useState(initialMode === 'lb' ? 'lb' : 'kg')

  // Seed interactive defaults for spin demo / lb / height tabs via DOM hooks
  return (
    <div
      className="min-h-[100dvh] bg-[#0c0c0e] px-4 pb-10 pt-8 text-white"
      data-height-weight-fixture="1"
      data-mode={initialMode}
      data-unit-pref={unitPref}
    >
      <HeightWeightPicker
        value={{ weightKg, heightCm }}
        onChange={(next) => {
          setWeightKg(next.weightKg)
          setHeightCm(next.heightCm)
          setNoted(false)
        }}
        onSave={(next) => {
          setWeightKg(next.weightKg)
          setHeightCm(next.heightCm)
          setNoted(true)
        }}
        onSkip={() => {
          /* no-op for fixture */
        }}
        onErase={() => {
          setWeightKg(null)
          setHeightCm(null)
          setNoted(false)
        }}
        allowErase={initialMode === 'erase' || (weightKg != null && heightCm != null)}
        confirmMessage={noted ? 'C’est noté.' : null}
      />
      {/* Helpers for capture script — switch tabs/units without flaky coords */}
      <div className="sr-only" aria-hidden>
        <button
          type="button"
          data-testid="fixture-force-height-tab"
          onClick={() => {
            document.querySelector<HTMLButtonElement>('[data-testid="height-weight-tab-height"]')?.click()
          }}
        >
          height
        </button>
        <button
          type="button"
          data-testid="fixture-force-lb"
          onClick={() => {
            setUnitPref('lb')
            document.querySelector<HTMLButtonElement>('[data-testid="weight-unit-lb"]')?.click()
          }}
        >
          lb
        </button>
        <button
          type="button"
          data-testid="fixture-force-weight-tab"
          onClick={() => {
            document.querySelector<HTMLButtonElement>('[data-testid="height-weight-tab-weight"]')?.click()
          }}
        >
          weight
        </button>
      </div>
    </div>
  )
}
