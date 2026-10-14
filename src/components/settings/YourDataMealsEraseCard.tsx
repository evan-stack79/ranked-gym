import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { IosSheet } from '../ui/IosSheet'
import {
  ERASE_MEALS_CONNECT_MESSAGE,
  ERASE_MEALS_COUNT_UNKNOWN_MESSAGE,
  ERASE_MEALS_NONE_MESSAGE,
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  EraseMealsNeedsConnectionError,
  EraseMealsPurgeError,
  eraseAllUserMeals,
  fetchMealsEraseCardState,
} from '../../services/eraseUserMeals'
import { useAuth } from '../../context/AuthContext'

export type EraseCardCountMode = 'ready' | 'none' | 'unknown' | 'signed_out'

interface YourDataMealsErasePanelProps {
  /** Count serveur (ignoré si mode signed_out / unknown / none). */
  serverCount: number
  pendingCount?: number
  countMode: EraseCardCountMode
  onRequestErase: () => void | Promise<void>
  busy?: boolean
  error?: string | null
  confirmOpen: boolean
  onConfirmOpenChange: (open: boolean) => void
  onSignedOutTap?: () => void
  /** true quand erase est bloqué (unknown / none / signed_out). */
  eraseDisabled?: boolean
}

function countLabel(mode: EraseCardCountMode, serverCount: number): string {
  if (mode === 'signed_out') return 'Connexion requise'
  if (mode === 'unknown') return ERASE_MEALS_COUNT_UNKNOWN_MESSAGE
  if (mode === 'none') return ERASE_MEALS_NONE_MESSAGE
  return `${serverCount} repas gardé${serverCount > 1 ? 's' : ''}`
}

/** Présentation — carte live + fixture. */
export function YourDataMealsErasePanel({
  serverCount,
  pendingCount = 0,
  countMode,
  onRequestErase,
  busy = false,
  error = null,
  confirmOpen,
  onConfirmOpenChange,
  onSignedOutTap,
  eraseDisabled = false,
}: YourDataMealsErasePanelProps) {
  const signedOut = countMode === 'signed_out'
  const disabled = eraseDisabled || signedOut || countMode === 'unknown' || countMode === 'none'

  return (
    <div className="space-y-2" data-testid="your-data-meals-section">
      <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        Tes données
      </p>
      <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80">
        <button
          type="button"
          data-testid="erase-old-meals-button"
          disabled={disabled && !signedOut}
          onClick={() => {
            if (signedOut) {
              onSignedOutTap?.()
              return
            }
            if (disabled) return
            onConfirmOpenChange(true)
          }}
          className="ios-press flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
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
              {countLabel(countMode, serverCount)}
            </span>
            {countMode === 'ready' && pendingCount > 0 ? (
              <span
                className="mt-0.5 block text-[12px] text-[#8E8E93]"
                data-testid="erase-old-meals-pending"
              >
                + {pendingCount} repas pas encore envoyés
              </span>
            ) : null}
          </span>
        </button>
      </div>

      {signedOut && error ? (
        <p
          className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]"
          data-testid="erase-old-meals-signed-out-error"
        >
          {error}
        </p>
      ) : null}

      {!signedOut && countMode === 'unknown' ? (
        <p
          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[13px] text-[#AEAEB2]"
          data-testid="erase-old-meals-unknown"
        >
          {ERASE_MEALS_COUNT_UNKNOWN_MESSAGE}
        </p>
      ) : null}

      <IosSheet
        open={confirmOpen && !signedOut && !disabled}
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
            Tu vas supprimer définitivement {serverCount} repas enregistré
            {serverCount > 1 ? 's' : ''}
            {pendingCount > 0 ? ` (+ ${pendingCount} pas encore envoyés)` : ''}. Aucun détail n’est
            affiché ici. Cette action vide aussi le cache de ton téléphone.
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
 * Profil > Tes données — toujours visible.
 */
export function YourDataMealsEraseCard() {
  const { isAuthenticated } = useAuth()
  const [serverCount, setServerCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [countMode, setCountMode] = useState<EraseCardCountMode>('signed_out')
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCountMode('signed_out')
      setServerCount(0)
      setPendingCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const state = await fetchMealsEraseCardState()
      setPendingCount(state.pendingCount)
      if (state.signedOut) {
        setCountMode('signed_out')
        setServerCount(0)
      } else if (state.serverCount == null) {
        setCountMode('unknown')
        setServerCount(0)
      } else if (state.serverCount === 0 && state.pendingCount === 0) {
        setCountMode('none')
        setServerCount(0)
      } else {
        setCountMode('ready')
        setServerCount(state.serverCount)
      }
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refresh()
    const onChange = () => {
      void refresh()
    }
    window.addEventListener('ranked-gym:profile-changed', onChange)
    return () => window.removeEventListener('ranked-gym:profile-changed', onChange)
  }, [refresh])

  if (loading && isAuthenticated) {
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

  const eraseDisabled =
    countMode === 'unknown' || countMode === 'none' || countMode === 'signed_out'

  return (
    <YourDataMealsErasePanel
      serverCount={serverCount}
      pendingCount={pendingCount}
      countMode={countMode}
      eraseDisabled={eraseDisabled}
      confirmOpen={confirmOpen}
      onConfirmOpenChange={(open) => {
        setError(null)
        setConfirmOpen(open)
      }}
      onSignedOutTap={() => {
        setConfirmOpen(false)
        setError(ERASE_MEALS_CONNECT_MESSAGE)
      }}
      busy={busy}
      error={error}
      onRequestErase={async () => {
        if (eraseDisabled) return
        setBusy(true)
        setError(null)
        try {
          await eraseAllUserMeals()
          setServerCount(0)
          setPendingCount(0)
          setCountMode('none')
          setConfirmOpen(false)
        } catch (err) {
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
