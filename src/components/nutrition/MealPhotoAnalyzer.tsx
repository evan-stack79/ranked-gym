import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  analyzeMealPhoto,
  getAiMealUsageToday,
  MealPhotoAiError,
  type MealPhotoMacros,
} from '../../services/mealPhotoAi'
import type { MealType } from '../../types/nutrition'

interface MealPhotoAnalyzerProps {
  mealType: MealType
  onAnalyzed: (macros: MealPhotoMacros & { name: string; mealType: MealType }) => void
  onToast?: (message: string) => void
}

export function MealPhotoAnalyzer({ mealType, onAnalyzed, onToast }: MealPhotoAnalyzerProps) {
  const { user, isAuthenticated, requireAuth } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setRemaining(null)
      return
    }
    void getAiMealUsageToday(user.id).then((u) => setRemaining(u.scansRemaining))
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const openPicker = () => {
    if (!isAuthenticated) {
      requireAuth(() => inputRef.current?.click())
      return
    }
    if (remaining === 0) {
      onToast?.('Limite atteinte : 3 analyses photo / jour.')
      return
    }
    inputRef.current?.click()
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setBusy(true)
    try {
      const macros = await analyzeMealPhoto(file)
      setRemaining(macros.scansRemaining)
      onAnalyzed({
        ...macros,
        name: 'Repas (IA)',
        mealType,
      })
      onToast?.(
        `IA : ${macros.calories} kcal · reste ${macros.scansRemaining}/${macros.dailyLimit} scans`,
      )
    } catch (e) {
      console.error('[MealPhotoAnalyzer]', e)
      const msg =
        e instanceof MealPhotoAiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Analyse impossible'
      if (e instanceof MealPhotoAiError && e.scansRemaining != null) {
        setRemaining(e.scansRemaining)
      }
      onToast?.(msg)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#BF5AF2]/15 p-2.5">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#BF5AF2]" />
          ) : (
            <Sparkles className="h-5 w-5 text-[#BF5AF2]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white">Photo → macros (Gemini)</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#8E8E93]">
            Compression locale puis analyse sécurisée. Max 3 / jour
            {remaining != null ? (
              <>
                {' '}
                · reste{' '}
                <span className={remaining === 0 ? 'text-[#FF453A]' : 'text-[#30D158]'}>
                  {remaining}
                </span>
              </>
            ) : null}
            .
          </p>
          <button
            type="button"
            onClick={openPicker}
            disabled={busy || remaining === 0}
            className="ios-press mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#BF5AF2]/40 bg-[#BF5AF2]/15 px-3.5 py-2 text-[13px] font-semibold text-[#E9D5FF] disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {busy ? 'Analyse…' : 'Photo repas'}
          </button>
        </div>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover border border-white/10"
          />
        ) : null}
      </div>
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
