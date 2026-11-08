import { useEffect, useRef, useState } from 'react'
import {
  CONTAINER_MAX_ML,
  CONTAINER_MIN_ML,
  MY_BOTTLE_PRESET_ML,
} from '../../shared/hydration'
import { CUTOUT_WIFI_HINT, manualCropToPng, runBottleCutout } from '../../services/hydration/cutoutEngine'
import {
  FACE_REFUSED_MESSAGE,
  FACE_UNAVAILABLE_MESSAGE,
  isFaceDetectorAvailable,
  refuseIfFaceDetected,
} from '../../services/hydration/faceRefuse'
import { saveBottleShapePng } from '../../services/hydration/bottleShapeStorage'
import {
  setBottleShapeFlag,
  updateHydrationSettings,
} from '../../services/hydration/hydrationService'

type Step = 'guide' | 'result' | 'crop' | 'volume' | 'done' | 'fallback'

interface BottleCaptureFlowProps {
  onDone: () => void
  onFallback2L: () => void
  onCancel: () => void
}

export function BottleCaptureFlow({ onDone, onFallback2L, onCancel }: BottleCaptureFlowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>(() =>
    isFaceDetectorAvailable() ? 'guide' : 'fallback',
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rawBlob, setRawBlob] = useState<Blob | null>(null)
  const [shapeBlob, setShapeBlob] = useState<Blob | null>(null)
  const [faceCleared, setFaceCleared] = useState(false)
  const [message, setMessage] = useState<string | null>(() =>
    isFaceDetectorAvailable() ? null : FACE_UNAVAILABLE_MESSAGE,
  )
  const [busy, setBusy] = useState(false)
  const [volumeMl, setVolumeMl] = useState(1000)
  const [crop, setCrop] = useState({ x: 40, y: 20, width: 200, height: 320 })

  useEffect(() => {
    if (!isFaceDetectorAvailable()) {
      setMessage(FACE_UNAVAILABLE_MESSAGE)
      setStep('fallback')
    }
  }, [])

  const clearRaw = () => {
    setRawBlob(null)
    setFaceCleared(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  const processFile = async (file: File) => {
    if (!isFaceDetectorAvailable()) {
      setMessage(FACE_UNAVAILABLE_MESSAGE)
      setStep('fallback')
      return
    }
    setBusy(true)
    setMessage(null)
    setFaceCleared(false)
    try {
      const face = await refuseIfFaceDetected(file)
      if (face.status === 'face_detected') {
        setMessage(FACE_REFUSED_MESSAGE)
        setStep('fallback')
        return
      }
      // M3 — sans détecteur fiable : jamais de sauvegarde d’une photo non contrôlée.
      if (face.status === 'unavailable') {
        setMessage(FACE_UNAVAILABLE_MESSAGE)
        setStep('fallback')
        return
      }

      setFaceCleared(true)
      setRawBlob(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)

      const cut = await runBottleCutout(file)
      if (cut.ok) {
        setShapeBlob(cut.png)
        setStep('result')
      } else {
        setMessage(cut.message)
        setStep('crop')
      }
    } finally {
      if (inputRef.current) inputRef.current.value = ''
      setBusy(false)
    }
  }

  const applyManualCrop = async () => {
    if (!rawBlob || !faceCleared) {
      setMessage(FACE_UNAVAILABLE_MESSAGE)
      setStep('fallback')
      return
    }
    setBusy(true)
    try {
      const png = await manualCropToPng(rawBlob, crop)
      setShapeBlob(png)
      setStep('result')
    } catch {
      setMessage('Recadrage impossible. Passe en mode 2 L.')
      setStep('fallback')
    } finally {
      setBusy(false)
    }
  }

  const validateShape = async () => {
    if (!shapeBlob || !faceCleared) return
    setStep('volume')
  }

  const saveAll = async () => {
    if (!shapeBlob || !faceCleared || !isFaceDetectorAvailable()) {
      setMessage(FACE_UNAVAILABLE_MESSAGE)
      setStep('fallback')
      return
    }
    const vol = Math.round(volumeMl)
    if (vol < CONTAINER_MIN_ML || vol > CONTAINER_MAX_ML) {
      setMessage(`Volume entre ${CONTAINER_MIN_ML} et ${CONTAINER_MAX_ML} ml.`)
      return
    }
    setBusy(true)
    try {
      await saveBottleShapePng(shapeBlob)
      await updateHydrationSettings({
        mode: 'my_bottle',
        myBottleVolumeMl: vol,
      })
      await setBottleShapeFlag(true)
      clearRaw()
      setStep('done')
      onDone()
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('HYDRATION_PRO_REQUIRED')) {
        setMessage('Ma bouteille nécessite Pass Pro.')
        setStep('fallback')
      } else {
        setMessage('Enregistrement impossible. Réessaie ou mode 2 L.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" data-hydration-capture-flow>
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-semibold text-white">Ma bouteille</p>
        <button type="button" onClick={onCancel} className="text-[14px] text-[#8E8E93]">
          Fermer
        </button>
      </div>

      {step === 'guide' ? (
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] rounded-2xl border border-dashed border-white/30 bg-black/40">
            <div className="absolute inset-6 rounded-xl border border-dashed border-[#5AC8FA]/50" />
            <p className="absolute inset-x-4 bottom-4 text-center text-[13px] text-[#C7C7CC]">
              Fond uni · bouteille droite, entière · sans visage
            </p>
          </div>
          <p className="text-[12px] leading-snug text-[#8E8E93]">{CUTOUT_WIFI_HINT}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void processFile(file)
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="ios-press min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white disabled:opacity-50"
            data-hydration-capture-shutter
          >
            {busy ? 'Traitement…' : 'Prendre la photo'}
          </button>
          <button
            type="button"
            onClick={onFallback2L}
            className="ios-press min-h-11 w-full rounded-2xl border border-white/15 text-[14px] font-medium text-white"
          >
            Utiliser la bouteille 2 L
          </button>
        </div>
      ) : null}

      {step === 'crop' && previewUrl && faceCleared ? (
        <div className="space-y-3">
          <p className="text-[14px] text-[#C7C7CC]">Recadre ta bouteille à la main</p>
          {message ? <p className="text-[12px] text-[#C7C7CC]">{message}</p> : null}
          <img src={previewUrl} alt="" className="mx-auto max-h-64 rounded-xl object-contain" />
          <div className="grid grid-cols-2 gap-2 text-[12px] text-[#ACB4BA]">
            {(['x', 'y', 'width', 'height'] as const).map((key) => (
              <label key={key} className="flex flex-col gap-1">
                {key}
                <input
                  type="number"
                  value={crop[key]}
                  onChange={(e) => setCrop((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-white"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void applyManualCrop()}
            className="ios-press min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
          >
            Appliquer le recadrage
          </button>
          <button
            type="button"
            onClick={onFallback2L}
            className="ios-press min-h-11 w-full rounded-2xl border border-white/15 text-[14px] text-white"
          >
            Mode 2 L
          </button>
        </div>
      ) : null}

      {step === 'result' && shapeBlob && faceCleared ? (
        <div className="space-y-3">
          <p className="text-[14px] text-[#C7C7CC]">Aperçu découpé</p>
          <img
            src={URL.createObjectURL(shapeBlob)}
            alt=""
            className="mx-auto max-h-64 object-contain"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void validateShape()}
              className="ios-press min-h-11 flex-1 rounded-2xl bg-[#FF0702] text-[14px] font-semibold text-white"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => {
                clearRaw()
                setShapeBlob(null)
                setStep('guide')
              }}
              className="ios-press min-h-11 flex-1 rounded-2xl border border-white/15 text-[14px] text-white"
            >
              Refaire
            </button>
            <button
              type="button"
              onClick={() => setStep('crop')}
              className="ios-press min-h-11 flex-1 rounded-2xl border border-white/15 text-[14px] text-white"
            >
              Recadrer
            </button>
          </div>
        </div>
      ) : null}

      {step === 'volume' && faceCleared ? (
        <div className="space-y-3">
          <p className="text-[14px] font-semibold text-white">Volume de ta bouteille</p>
          <div className="flex flex-wrap gap-2">
            {MY_BOTTLE_PRESET_ML.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => setVolumeMl(ml)}
                className={`ios-press rounded-xl px-3 py-2 text-[13px] font-semibold ${
                  volumeMl === ml ? 'bg-[#FF0702] text-white' : 'bg-white/10 text-white'
                }`}
              >
                {ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}
              </button>
            ))}
          </div>
          <label className="block text-[12px] text-[#8E8E93]">
            Autre (ml)
            <input
              type="number"
              min={CONTAINER_MIN_ML}
              max={CONTAINER_MAX_ML}
              value={volumeMl}
              onChange={(e) => setVolumeMl(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
            />
          </label>
          {message ? <p className="text-[12px] text-[#C7C7CC]">{message}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveAll()}
            className="ios-press min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
          >
            Enregistrer
          </button>
        </div>
      ) : null}

      {step === 'fallback' ? (
        <div className="space-y-3" data-hydration-capture-fallback>
          {message ? <p className="text-[14px] leading-snug text-[#C7C7CC]">{message}</p> : null}
          <button
            type="button"
            onClick={onFallback2L}
            className="ios-press min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
            data-hydration-fallback-2l
          >
            Passer au mode 2 L
          </button>
          {isFaceDetectorAvailable() ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null)
                setStep('guide')
              }}
              className="ios-press min-h-11 w-full rounded-2xl border border-white/15 text-[14px] text-white"
            >
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
