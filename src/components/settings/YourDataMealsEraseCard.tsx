import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { IosSheet } from '../ui/IosSheet'
import { canAccessFoodAdd } from '../../services/foodAddAccess'
import { getCalorieProfile } from '../../services/nutritionStorage'
import {
  ERASE_MEALS_CONNECT_MESSAGE,
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  EraseMealsNeedsConnectionError,
  EraseMealsPurgeError,
  eraseAllUserMeals,
  fetchStoredMealsCount,
} from '../../services/eraseUserMeals'
import { useAuth } from '../../context/AuthContext'

interface YourDataMealsErasePanelProps {
  count: number
  onRequestErase: () => void | Promise<void>
  busy?: boolean
  error?: string | null
  confirmOpen: boolean
  onConfirmOpenChange: (open: boolean) => void
}

/** Présentation — utilisée par la carte live et la fixture démo. */
export function YourDataMealsErasePanel({
  count,
  onRequestErase,
  busy = false,
  error = null,
  confirmOpen,
  onConfirmOpenChange,
}: YourDataMealsErasePanelProps) {
  if (count < 1) return null

  return (
    <div className="space-y-2" data-testid="your-data-meals-section">
      <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        Tes données
      </p>
      <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80">
        <button
          type="button"
          data-testid="erase-old-meals-button"
          onClick={() => onConfirmOpenChange(true)}
          className="ios-press flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF453A]/15 text-[#FF6961]">
            <Trash2 className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">
              Effacer mes anciens repas
            </span>
            <span
              className="mt-0.5 block text-[13px] text-[#8E8E93]"
              data-testid="erase-old-meals-count"
            >
              {count} repas gardé{count > 1 ? 's' : ''}
            </span>
          </span>
        </button>
      </div>

      <IosSheet
        open={confirmOpen}
        onClose={() => {
          if (!busy) onConfirmOpenChange(false)
        }}
        dismissible={!busy}
        title="Effacer mes anciens repas"
        subtitle="Action définitive"
        leading={<Trash2 className="mt-0.5 h-5 w-5 text-[#FF453A]" />}
      >
        <div className="space-y-3 pb-2">
          <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
            Tu vas supprimer définitivement {count} repas enregistré{count > 1 ? 's' : ''}. Aucun
            détail n’est affiché ici. Cette action vide aussi le cache de ton téléphone.
          </p>
          {error ? (
            <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="erase-old-meals-confirm"
            disabled={busy}
            onClick={() => void onRequestErase()}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/40 bg-[#FF453A]/20 py-3.5 text-[15px] font-semibold text-[#FF6961] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Suppression…
              </>
            ) : (
              'Oui, tout effacer'
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirmOpenChange(false)}
            className="ios-press w-full rounded-2xl border border-white/10 bg-black/30 py-3 text-[14px] font-medium text-[#AEAEB2] disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </IosSheet>
    </div>
  )
}

/**
 * Profil > Tes données — bouton « Effacer mes anciens repas ».
 * Visible seulement pour comptes bloqués (mineur / TCA / âge inconnu) et count ≥ 1.
 */
export function YourDataMealsEraseCard() {
  const { isAuthenticated } = useAuth()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profile = getCalorieProfile()
  const blocked = !canAccessFoodAdd(profile)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !blocked) {
      setCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await fetchStoredMealsCount()
      setCount(next)
    } finally {
      setLoading(false)
    }
  }, [blocked, isAuthenticated])

  useEffect(() => {
    void refresh()
    const onChange = () => {
      void refresh()
    }
    window.addEventListener('ranked-gym:profile-changed', onChange)
    return () => window.removeEventListener('ranked-gym:profile-changed', onChange)
  }, [refresh])

  if (!isAuthenticated || !blocked) return null
  if (loading) {
    return (
      <div className="space-y-2" data-testid="your-data-meals-loading">
        <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">
          Tes données
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-[#2C2C2E] bg-[#141416]/80 px-4 py-3.5 text-[13px] text-[#8E8E93]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Chargement…
        </div>
      </div>
    )
  }

  return (
    <YourDataMealsErasePanel
      count={count}
      confirmOpen={confirmOpen}
      onConfirmOpenChange={(open) => {
        setError(null)
        setConfirmOpen(open)
      }}
      busy={busy}
      error={error}
      onRequestErase={async () => {
        setBusy(true)
        setError(null)
        try {
          await eraseAllUserMeals()
          setCount(0)
          setConfirmOpen(false)
        } catch (err) {
          // Ne pas fermer le sheet ni remettre count à 0 → retryable.
          if (err instanceof EraseMealsNeedsConnectionError) {
            setError(ERASE_MEALS_CONNECT_MESSAGE)
          } else if (err instanceof EraseMealsPurgeError) {
            setError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
          } else {
            setError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
          }
        } finally {
          setBusy(false)
        }
      }}
    />
  )
}
