import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, Share2, Trash2, X } from 'lucide-react'
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
type FacingMode = 'user' | 'environment'

function formatVolume(kg: number): string {
  return Math.round(kg).toLocaleString('fr-FR')
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} MIN`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}H ${m}M` : `${h}H`
}

function prLabel(count: number): string {
  return count === 1 ? '1 PR BATTU' : `${count} PR BATTUS`
}

/**
 * Pump Check — UI streetwear / brutaliste.
 * Zone « ViewShot » = photo + overlay stats uniquement.
 * Barre d'actions (pilule) hors capture.
 */
export function VictoryCamera({ stats, onComplete }: VictoryCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { setChromeHidden } = useRestTimerContext()

  const [phase, setPhase] = useState<Phase>('camera')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode] = useState<FacingMode>('user')
  const [busy, setBusy] = useState<'save' | 'share' | null>(null)
  const [actionHint, setActionHint] = useState<string | null>(null)

  const isFrontCamera = facingMode === 'user'

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
          facingMode: { ideal: facingMode },
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
      setCameraError('Autorise l\'accès à la caméra pour le Pump Check.')
    }
  }, [facingMode, stopCamera])

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

    // Miroir selfie : capture = prévisualisation scaleX(-1)
    if (isFrontCamera) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        if (photoUrl) URL.revokeObjectURL(photoUrl)
        setPhotoUrl(URL.createObjectURL(blob))
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
      setActionHint('Carte sauvegardée ✓')
      vibrate(12)
    } catch {
      setActionHint('Sauvegarde impossible')
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
      setActionHint(result === 'shared' ? 'Partagée ✓' : 'Téléchargée ✓')
      vibrate(12)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setActionHint('Partage impossible')
    } finally {
      setBusy(null)
    }
  }

  /** Zone exportable = photo + overlay stats (ViewShot sans boutons). */
  const shotOverlay = (
    <div className="pointer-events-none absolute inset-0 flex flex-col" data-victory-shot>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.08) 28%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.05) 58%, rgba(0,0,0,0.78) 100%)',
        }}
        aria-hidden
      />

      <div
        className="relative z-10 px-5 text-left"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em]">
          <span className="text-[#FF2B2B]">Ranked</span>{' '}
          <span className="text-white">Gym</span>
          <span className="text-[#C7C7CC]"> // UPPER</span>
        </p>
        <p className="mt-2 max-w-[85%] text-[22px] font-black uppercase leading-[1.05] tracking-tight text-white">
          Séance
          <br />
          validée
        </p>
        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
          {stats.title}
        </p>
      </div>

      <div className="relative z-10 mt-auto px-5 pb-4 text-left">
        <div className="flex items-end gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">Volume</p>
            <p className="mt-0.5 text-[48px] font-black leading-none tracking-tighter text-white tabular-nums">
              {formatVolume(stats.volumeKg)}
              <span className="ml-1 text-[18px] font-bold tracking-normal text-white/60">KG</span>
            </p>
          </div>
          <div className="pb-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">Temps</p>
            <p className="mt-0.5 text-[32px] font-black leading-none tracking-tight text-white tabular-nums">
              {formatDuration(stats.durationMin)}
            </p>
          </div>
        </div>

        {stats.prCount > 0 ? (
          <p className="mt-3 inline-block border border-white/25 bg-black/35 px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.16em] text-[#FF453A]">
            {prLabel(stats.prCount)}
          </p>
        ) : null}
      </div>
    </div>
  )

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
              <div className="flex h-full flex-col items-start justify-center gap-4 px-8 text-left">
                <p className="text-[15px] leading-relaxed text-[#AEAEB2]">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="ios-press rounded-none border border-white/30 bg-white/10 px-5 py-3 text-[13px] font-bold uppercase tracking-wider text-white"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
                playsInline
                muted
                autoPlay
              />
            )}

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)',
              }}
              aria-hidden
            />

            <div
              className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-5 text-left"
              style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
            >
              <div className="pointer-events-none min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em]">
                  <span className="text-[#FF2B2B]">Ranked</span>{' '}
                  <span className="text-white">Gym</span>
                  <span className="text-[#C7C7CC]"> // UPPER</span>
                </p>
                <p className="mt-2 text-[20px] font-black uppercase tracking-tight text-white">
                  Pump Check
                </p>
              </div>
              <button
                type="button"
                onClick={onComplete}
                className="ios-press -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-md"
                aria-label="Passer et retour Lobby"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </div>

          <div
            className="flex shrink-0 flex-col items-center gap-4 bg-black px-6 pt-5"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="ios-press relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white bg-transparent disabled:opacity-40"
              aria-label="Prendre la photo"
            >
              <span className="h-[54px] w-[54px] rounded-full bg-[#FF2B2B] shadow-[0_0_28px_rgba(255,43,43,0.55)]" />
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="ios-press rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#AEAEB2]"
            >
              Passer
            </button>
          </div>
        </>
      ) : (
        <>
          {/* VIEWSHOT : photo + stats uniquement */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            {photoUrl ? (
              <img src={photoUrl} alt="Pump Check" className="h-full w-full object-cover" />
            ) : null}
            {shotOverlay}
          </div>

          {/* ACTIONS hors capture */}
          <div
            className="shrink-0 px-4 pt-3"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {actionHint ? (
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#30D158]">
                {actionHint}
              </p>
            ) : null}

            <div
              className="mx-auto flex max-w-sm items-center justify-between gap-1 rounded-full border border-white/15 px-2 py-2"
              style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={!!busy}
                className="ios-press flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-50"
                aria-label="Partager"
              >
                {busy === 'share' ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                ) : (
                  <Share2 className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!!busy}
                className="ios-press flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-50"
                aria-label="Sauvegarder"
              >
                {busy === 'save' ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                ) : (
                  <Download className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
                )}
              </button>

              <button
                type="button"
                onClick={retake}
                className="ios-press flex h-11 w-11 items-center justify-center rounded-full text-white/80"
                aria-label="Reprendre la photo"
              >
                <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
              </button>

              <button
                type="button"
                onClick={onComplete}
                className="ios-press flex h-11 w-11 items-center justify-center rounded-full bg-white text-black"
                aria-label="Fermer et retour Lobby"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
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
