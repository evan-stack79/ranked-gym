import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  analyzeMealPhoto,
  getAiMealUsageToday,
  MealPhotoAiError,
  type MealPhotoMacros,
} from '../../services/mealPhotoAi'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import type { MealType } from '../../types/nutrition'
import { safeError } from '../../utils/safeLog'

interface MealPhotoAnalyzerProps {
  onAnalyzed: (macros: MealPhotoMacros & { name: string; mealType: MealType }) => void
  onToast?: (message: string, variant?: 'success' | 'error') => void
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function defaultMealType(): MealType {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export function MealPhotoAnalyzer({ onAnalyzed, onToast }: MealPhotoAnalyzerProps) {
  const { user, isAuthenticated, requireAuth } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshQuota = useCallback(async () => {
    if (!user?.id) {
      setRemaining(null)
      return
    }
    const usage = await getAiMealUsageToday(user.id)
    setRemaining(usage.scansRemaining)
  }, [user?.id])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  useEffect(() => {
    const sync = () => void refreshQuota()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [refreshQuota])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const openPicker = () => {
    setErrorMessage(null)
    if (!isAuthenticated) {
      requireAuth(() => inputRef.current?.click())
      return
    }
    if (remaining === 0) {
      const msg = 'Limite atteinte : 5 analyses photo / jour.'
      setErrorMessage(msg)
      onToast?.(msg, 'error')
      return
    }
    inputRef.current?.click()
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setErrorMessage(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setBusy(true)

    try {
      const macros = await analyzeMealPhoto(file)
      setRemaining(macros.scansRemaining)
      void refreshQuota()

      onAnalyzed({
        ...macros,
        name: 'Repas (IA)',
        mealType,
      })

      onToast?.(
        `+${macros.calories} kcal ajoutées · ${macros.scansRemaining}/${macros.dailyLimit} scans restants`,
        'success',
      )
    } catch (e) {
      safeError('[MealPhotoAnalyzer]', e)
      const msg =
        e instanceof MealPhotoAiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Analyse impossible — réessaie.'

      if (e instanceof MealPhotoAiError && e.scansRemaining != null) {
        setRemaining(e.scansRemaining)
      } else {
        void refreshQuota()
      }

      setErrorMessage(msg)
      onToast?.(msg, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-[#BF5AF2]/15 p-2.5">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#BF5AF2]" />
          ) : (
            <Sparkles className="h-5 w-5 text-[#BF5AF2]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white">Photo → macros (Gemini)</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#8E8E93]">
            Compression locale puis analyse sécurisée.
          </p>
          <p
            className={`mt-1 text-[12px] font-semibold tabular-nums ${
              remaining === 0 ? 'text-[#FF453A]' : 'text-[#30D158]'
            }`}
          >
            {remaining == null
              ? 'Scans IA : —/5 restants aujourd’hui'
              : `Scans IA : ${remaining}/5 restants aujourd’hui`}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                disabled={busy}
                onClick={() => setMealType(type)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  mealType === type
                    ? 'border-[#BF5AF2]/45 bg-[#BF5AF2]/20 text-[#E9D5FF]'
                    : 'border-white/10 bg-black/25 text-[#8E8E93]'
                }`}
              >
                {MEAL_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openPicker}
            disabled={busy || remaining === 0}
            className="ios-press mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#BF5AF2]/40 bg-[#BF5AF2]/15 px-3.5 py-2 text-[13px] font-semibold text-[#E9D5FF] disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {busy ? 'Analyse en cours…' : 'Photo repas'}
          </button>
        </div>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Aperçu repas"
            className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover"
          />
        ) : null}
      </div>

      {errorMessage ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-[#FF453A]/35 bg-[#FF453A]/10 px-3 py-2.5"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6961]" />
          <p className="text-[12px] leading-snug text-[#FF6961]">{errorMessage}</p>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  )
}
