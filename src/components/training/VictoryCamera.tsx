import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Download, Loader2, Share2 } from 'lucide-react'
import type { VictorySessionStats } from '../../types/victory'
import {
  exportVictoryCard,
  saveVictoryCardToGallery,
  shareVictoryCard,
} from '../../utils/victoryCardExport'
import { vibrate } from '../../utils/haptics'
import { useRestTimerContext } from '../../context/RestTimerContext'

interface VictoryCameraProps {
  stats: VictorySessionStats
  onComplete: () => void
}

type Phase = 'camera' | 'preview'

function formatVolume(kg: number): string {
  return `${kg.toLocaleString('fr-FR')} kg`
}

/**
 * Pump Check plein écran — portail hors du stacking context AppLayout
 * pour passer au-dessus Tab Bar / timer repos.
 */
export function VictoryCamera({ stats, onComplete }: VictoryCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { setChromeHidden } = useRestTimerContext()

  const [phase, setPhase] = useState<Phase>('camera')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'share' | null>(null)
  const [actionHint, setActionHint] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    stopCamera()
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Appareil photo indisponible sur cet appareil.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError('Autorise l’accès à la caméra pour le Pump Check.')
    }
  }, [stopCamera])

  // Masque Tab Bar + tue le timer zombie pendant tout le Pump Check
  useEffect(() => {
    setChromeHidden(true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      setChromeHidden(false)
      document.body.style.overflow = previousOverflow
      stopCamera()
    }
  }, [setChromeHidden, stopCamera])

  useEffect(() => {
    if (phase !== 'camera') return
    void startCamera()
    return () => stopCamera()
  }, [phase, startCamera, stopCamera])

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        if (photoUrl) URL.revokeObjectURL(photoUrl)
        const url = URL.createObjectURL(blob)
        setPhotoUrl(url)
        setPhase('preview')
        stopCamera()
        vibrate(14)
      },
      'image/jpeg',
      0.92,
    )
  }

  const retake = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)
    setActionHint(null)
    setPhase('camera')
  }

  const handleSave = async () => {
    if (!photoUrl || busy) return
    setBusy('save')
    setActionHint(null)
    try {
      const blob = await exportVictoryCard(photoUrl, stats)
      await saveVictoryCardToGallery(blob)
      setActionHint('Carte sauvegardée dans tes téléchargements ✓')
      vibrate(12)
    } catch {
      setActionHint('Impossible de sauvegarder — réessaie.')
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (!photoUrl || busy) return
    setBusy('share')
    setActionHint(null)
    try {
      const blob = await exportVictoryCard(photoUrl, stats)
      const result = await shareVictoryCard(blob, stats.title)
      setActionHint(
        result === 'shared'
          ? 'Carte partagée ✓'
          : 'Partage indisponible — carte téléchargée ✓',
      )
      vibrate(12)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setActionHint('Impossible de partager — réessaie.')
    } finally {
      setBusy(null)
    }
  }

  const ui = (
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Pump Check — photo de victoire"
    >
      {phase === 'camera' ? (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            {cameraError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                <p className="text-[15px] leading-relaxed text-[#AEAEB2]">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="ios-press rounded-2xl border border-[#FF2B2B]/40 bg-[#FF2B2B]/20 px-5 py-3 text-[14px] font-semibold text-white"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            )}

            <div
              className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pb-16"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            >
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6961]">
                Pump Check
              </p>
              <h2 className="mt-1 text-center text-[22px] font-bold text-white">Montre ta victoire</h2>
            </div>
          </div>

          <div
            className="flex shrink-0 flex-col items-center gap-4 bg-black px-6 pt-6"
            style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="ios-press relative z-10 flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white/90 bg-transparent disabled:opacity-40"
              aria-label="Prendre la photo"
            >
              <span className="h-[58px] w-[58px] rounded-full bg-[#FF2B2B] shadow-[0_0_32px_rgba(255,43,43,0.65)]" />
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="ios-press text-[13px] font-medium text-[#8E8E93]"
            >
              Passer · Retour au Lobby
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {photoUrl ? (
              <img src={photoUrl} alt="Pump Check" className="h-full w-full object-cover" />
            ) : null}

            <div className="pointer-events-none absolute inset-0 bg-black/40" aria-hidden />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(145deg, rgba(255,43,43,0.32) 0%, rgba(0,0,0,0.15) 45%, rgba(255,43,43,0.22) 100%)',
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-4 rounded-[28px] border-2 border-[#FF2B2B] shadow-[inset_0_0_40px_rgba(255,43,43,0.2)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-7 rounded-[22px] border border-[#FF6961]/50"
              aria-hidden
            />

            <div
              className="pointer-events-none absolute inset-x-0 top-0 px-6 text-center"
              style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#FF6961] drop-shadow-lg">
                Ranked Gym
              </p>
              <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.22em] text-white drop-shadow-lg">
                Séance validée
              </p>
              <p className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-[#FF6961]">
                {stats.title}
              </p>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-4 px-6 text-center">
              <p className="text-[56px] font-black leading-none tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                {formatVolume(stats.volumeKg)}
              </p>
              <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.18em] text-[#AEAEB2]">
                Volume total
              </p>
              <p className="mt-4 text-[36px] font-black tabular-nums text-white drop-shadow-lg">
                {stats.durationMin} min
              </p>
              <p className="mt-3 text-[28px] font-black uppercase text-[#FF2B2B] drop-shadow-lg">
                {stats.prCount === 0
                  ? '0 PR'
                  : stats.prCount === 1
                    ? '1 PR battu'
                    : `${stats.prCount} PR battus`}
              </p>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                Ranked Gym · Pump Check
              </p>
            </div>
          </div>

          <div
            className="shrink-0 space-y-2.5 bg-black px-5 pt-4"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {actionHint ? (
              <p className="text-center text-[12px] font-medium text-[#30D158]">{actionHint}</p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!!busy}
                className="ios-press flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.08] py-3.5 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {busy === 'save' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                Sauvegarder
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={!!busy}
                className="ios-press flex items-center justify-center gap-2 rounded-2xl border border-[#FF2B2B]/45 bg-[#FF2B2B]/22 py-3.5 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {busy === 'share' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden />
                )}
                Partager
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={retake}
                className="ios-press flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.06] py-3.5 text-[14px] font-semibold text-[#AEAEB2]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Reprendre
              </button>
              <button
                type="button"
                onClick={onComplete}
                className="ios-press flex flex-[1.4] items-center justify-center rounded-2xl border border-white/12 bg-white py-3.5 text-[14px] font-semibold text-black"
              >
                Retour au Lobby
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(ui, document.body)
}
