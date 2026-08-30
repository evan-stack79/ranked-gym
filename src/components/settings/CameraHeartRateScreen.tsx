import { HeartPulse } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAMERA_HEART_RATE_DISCLAIMER,
  CameraHeartRate,
  type CameraHeartRateProgressEvent,
  type CameraHeartRateResultEvent,
} from '../../native/cameraHeartRate'
import { ProfileSubScreenHeader } from './ProfileSubScreenChrome'

interface CameraHeartRateScreenProps {
  onBack: () => void
}

/**
 * Prototype expérimental — bien-être uniquement.
 * Aucune valeur n’est sauvegardée (localStorage / Supabase / Health).
 */
export function CameraHeartRateScreen({ onBack }: CameraHeartRateScreenProps) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<CameraHeartRateProgressEvent | null>(null)
  const [result, setResult] = useState<CameraHeartRateResultEvent | null>(null)
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const listenersRef = useRef<Array<{ remove: () => Promise<void> }>>([])

  const detachListeners = useCallback(async () => {
    const listeners = listenersRef.current
    listenersRef.current = []
    await Promise.all(listeners.map((listener) => listener.remove()))
    await CameraHeartRate.removeAllListeners()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const availability = await CameraHeartRate.isAvailable()
      if (cancelled) return
      if (!availability.available) {
        setAvailabilityMessage(
          availability.reason ??
            'Mesure BPM indisponible sur cet appareil (caméra / flash).',
        )
      }
    })()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void CameraHeartRate.stopMeasurement()
        setBusy(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onVisibility)
      void CameraHeartRate.stopMeasurement()
      void detachListeners()
    }
  }, [detachListeners])

  const start = async () => {
    setResult(null)
    setProgress(null)
    setBusy(true)
    await detachListeners()

    const progressHandle = await CameraHeartRate.addListener('progress', (event) => {
      setProgress(event)
    })
    const resultHandle = await CameraHeartRate.addListener('result', (event) => {
      setResult(event)
      setBusy(false)
    })
    listenersRef.current = [progressHandle, resultHandle]

    try {
      await CameraHeartRate.startMeasurement()
    } catch (error) {
      setBusy(false)
      setResult({
        ok: false,
        reason: 'camera_error',
        message:
          error instanceof Error
            ? error.message
            : 'Impossible de démarrer la mesure BPM.',
      })
    }
  }

  const stop = async () => {
    await CameraHeartRate.stopMeasurement()
    setBusy(false)
  }

  const qualityPct = Math.round((progress?.signalQuality ?? 0) * 100)
  const liveBpm =
    result?.ok && result.bpm
      ? result.bpm
      : progress?.bpmPreview
        ? progress.bpmPreview
        : null

  return (
    <div className="flex flex-col gap-4 pb-8">
      <ProfileSubScreenHeader
        title="Mesure BPM"
        subtitle="Prototype caméra · non médical"
        onBack={onBack}
      />

      <div className="rounded-2xl border border-[#FF9F0A]/35 bg-[#FF9F0A]/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-[#FF9F0A]">
          <HeartPulse className="h-4 w-4" aria-hidden />
          <p className="text-[13px] font-semibold uppercase tracking-wide">
            Expérimental — non médical
          </p>
        </div>
        <p className="text-[13px] leading-relaxed text-[#FFD60A]/95">
          {CAMERA_HEART_RATE_DISCLAIMER}
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4">
        <p className="text-[15px] font-semibold text-white">Comment faire</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-[#AEAEB2]">
          <li>Pose le doigt sur la caméra arrière et le flash.</li>
          <li>Reste immobile 12–20 secondes.</li>
          <li>Si le doigt bouge ou laisse passer la lumière : pas de résultat.</li>
        </ol>
      </div>

      {availabilityMessage ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-[#AEAEB2]">
          {availabilityMessage}
        </p>
      ) : null}

      <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-6 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
          {busy ? 'Mesure en cours' : 'Prêt'}
        </p>
        <p className="text-[48px] font-bold tabular-nums tracking-tight text-white">
          {liveBpm ?? '—'}
        </p>
        <p className="text-[13px] text-[#8E8E93]">BPM estimé</p>
        {progress ? (
          <div className="w-full space-y-1 text-[12px] text-[#AEAEB2]">
            <p>
              Doigt :{' '}
              <span className="font-semibold text-white">
                {progress.fingerDetected ? 'détecté' : 'absent'}
              </span>
            </p>
            <p>
              Signal :{' '}
              <span className="font-semibold tabular-nums text-white">{qualityPct}%</span>
            </p>
            {progress.message ? <p>{progress.message}</p> : null}
          </div>
        ) : null}
        {result ? (
          <p
            className={`text-[13px] leading-relaxed ${
              result.ok ? 'text-[#30D158]' : 'text-[#FF9F0A]'
            }`}
          >
            {result.ok
              ? `Estimation : ${result.bpm} BPM (confiance ${Math.round(
                  (result.confidence ?? 0) * 100,
                )}%). Non enregistrée.`
              : (result.message ?? 'Mesure non concluante.')}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {busy ? (
          <button
            type="button"
            onClick={() => void stop()}
            className="ios-press min-h-12 flex-1 rounded-2xl border border-white/15 bg-white/10 text-[15px] font-semibold text-white"
          >
            Annuler
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={Boolean(availabilityMessage)}
            className="ios-press min-h-12 flex-1 rounded-2xl border border-[#FF2B2B]/40 bg-[#FF2B2B]/20 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            Démarrer la mesure
          </button>
        )}
      </div>
    </div>
  )
}
