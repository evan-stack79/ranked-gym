import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import type { VictorySessionStats } from '../../types/victory'
import { exportVictoryCard, shareOrSaveVictoryCard } from '../../utils/victoryCardExport'
import { vibrate } from '../../utils/haptics'

interface VictoryCameraProps {
  stats: VictorySessionStats
  onComplete: () => void
}

type Phase = 'camera' | 'preview'

function formatVolume(kg: number): string {
  return `${kg.toLocaleString('fr-FR')} kg`
}

export function VictoryCamera({ stats, onComplete }: VictoryCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('camera')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shareHint, setShareHint] = useState<string | null>(null)

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

  useEffect(() => {
    if (phase !== 'camera') return
    void startCamera()
    return () => stopCamera()
  }, [phase, startCamera, stopCamera])

  useEffect(() => {
    return () => {
      stopCamera()
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl, stopCamera])

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
    setShareHint(null)
    setPhase('camera')
  }

  const handleShare = async () => {
    if (!photoUrl || busy) return
    setBusy(true)
    setShareHint(null)
    try {
      const blob = await exportVictoryCard(photoUrl, stats)
      const result = await shareOrSaveVictoryCard(blob, stats.title)
      setShareHint(
        result === 'shared'
          ? 'Carte partagée ✓'
          : 'Carte enregistrée dans tes téléchargements ✓',
      )
      vibrate(12)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareHint('Impossible de partager — réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Pump Check — photo de victoire"
    >
      {phase === 'camera' ? (
        <>
          <div className="relative flex-1 overflow-hidden bg-black">
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

            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pb-16 pt-4">
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6961]">
                Pump Check
              </p>
              <h2 className="mt-1 text-center text-[22px] font-bold text-white">Montre ta victoire</h2>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-4 bg-black px-6 py-8">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="ios-press relative flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white/90 bg-transparent disabled:opacity-40"
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
          <div className="relative flex-1 overflow-hidden">
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

            <div className="pointer-events-none absolute inset-x-0 top-0 px-6 pt-6 text-center">
              <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-white drop-shadow-lg">
                Séance validée
              </p>
              <p className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-[#FF6961]">
                {stats.title}
              </p>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-28 px-6 text-center">
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
            </div>
          </div>

          <div className="shrink-0 space-y-3 bg-black/95 px-5 py-5">
            {shareHint ? (
              <p className="text-center text-[12px] font-medium text-[#30D158]">{shareHint}</p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={busy}
              className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF2B2B]/45 bg-[#FF2B2B]/22 py-4 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-5 w-5" aria-hidden />
              )}
              Partager / Sauvegarder dans la galerie
            </button>

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
}
