import { useState } from 'react'
import {
  getRestTimerSoundPrefs,
  previewRestTimerSound,
  setRestTimerCountdownBeeps,
  setRestTimerHaptics,
  setRestTimerSoundEnabled,
} from '../../utils/restTimerSound'

/**
 * Réglages son de repos — pas de dB, pas de promesse « sûr ».
 * Bouton « Écouter » (SON-20).
 */
export function RestTimerSoundSettings() {
  const [prefs, setPrefs] = useState(() => getRestTimerSoundPrefs())

  return (
    <section
      className="rounded-2xl border border-white/10 bg-black/30 p-3"
      data-rest-timer-sound-settings
      aria-label="Son du chrono de repos"
    >
      <h2 className="text-[15px] font-semibold text-white">Son du repos</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-[#8E8E93]">
        Court bip à la fin du compte à rebours. Suit le volume du téléphone.
      </p>

      <label className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[#D1D1D6]">Son activé</span>
        <input
          type="checkbox"
          checked={prefs.soundEnabled}
          onChange={(e) => setPrefs(setRestTimerSoundEnabled(e.target.checked))}
          className="h-5 w-5 accent-[#FF0702]"
          aria-label="Activer le son de fin de repos"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[#D1D1D6]">3 bips (3, 2, 1)</span>
        <input
          type="checkbox"
          checked={prefs.countdownBeeps}
          onChange={(e) => setPrefs(setRestTimerCountdownBeeps(e.target.checked))}
          className="h-5 w-5 accent-[#FF0702]"
          aria-label="Activer les trois bips avant la fin"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[#D1D1D6]">Vibration</span>
        <input
          type="checkbox"
          checked={prefs.haptics}
          onChange={(e) => setPrefs(setRestTimerHaptics(e.target.checked))}
          className="h-5 w-5 accent-[#FF0702]"
          aria-label="Activer la vibration de fin de repos"
        />
      </label>

      <button
        type="button"
        onClick={() => void previewRestTimerSound()}
        className="ios-press mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-[13px] font-semibold text-white"
        data-rest-timer-sound-preview
      >
        Écouter
      </button>
    </section>
  )
}
