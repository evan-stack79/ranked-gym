/**
 * Feature flag prototype BPM caméra.
 * Activé uniquement si VITE_ENABLE_CAMERA_HEART_RATE=true au build.
 */
export function isCameraHeartRateEnabled(): boolean {
  const raw = import.meta.env.VITE_ENABLE_CAMERA_HEART_RATE
  if (typeof raw !== 'string') return false
  const normalized = raw.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

/** Texte d’avertissement obligatoire (bien-être, non médical). */
export const CAMERA_HEART_RATE_DISCLAIMER =
  'Estimation expérimentale du rythme cardiaque via la caméra. ' +
  'Ce prototype sert uniquement au bien-être : ce n’est pas un dispositif médical, ' +
  'il ne diagnostique aucune maladie et ne détecte pas d’arythmie. ' +
  'Aucune valeur n’est enregistrée.'
