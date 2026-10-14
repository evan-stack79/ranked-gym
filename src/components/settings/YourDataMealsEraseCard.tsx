import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { IosSheet } from '../ui/IosSheet'
import {
  ERASE_MEALS_CONNECT_MESSAGE,
  ERASE_MEALS_COUNT_UNKNOWN_MESSAGE,
  ERASE_MEALS_NONE_MESSAGE,
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
  EraseMealsNeedsConnectionError,
  EraseMealsNeedsLegacyReconnectError,
  EraseMealsPurgeError,
  eraseAllUserMeals,
  fetchMealsEraseCardState,
} from '../../services/eraseUserMeals'
import { signInLegacySupabaseAndLink } from '../../services/accountLinkService'
import { useAuth } from '../../context/AuthContext'

export type EraseCardCountMode =
  | 'ready'
  | 'none'
  | 'unknown'
  | 'signed_out'
  | 'needs_legacy_reconnect'

interface YourDataMealsErasePanelProps {
  /** Count serveur (ignoré si mode signed_out / unknown / none / reconnect). */
  serverCount: number
  pendingCount?: number
  countMode: EraseCardCountMode
  onRequestErase: () => void | Promise<void>
  busy?: boolean
  error?: string | null
  confirmOpen: boolean
  onConfirmOpenChange: (open: boolean) => void
  onSignedOutTap?: () => void
  onNeedsLegacyReconnectTap?: () => void
  /** true quand erase est bloqué (unknown / none / signed_out / reconnect). */
  eraseDisabled?: boolean
  reconnectOpen?: boolean
  onReconnectOpenChange?: (open: boolean) => void
  reconnectEmail?: string
  reconnectPassword?: string
  onReconnectEmailChange?: (value: string) => void
  onReconnectPasswordChange?: (value: string) => void
  onReconnectSubmit?: () => void | Promise<void>
  reconnectBusy?: boolean
}

function countLabel(mode: EraseCardCountMode, serverCount: number): string {
  if (mode === 'signed_out') return 'Connexion requise'
  if (mode === 'needs_legacy_reconnect') return ERASE_MEALS_RECONNECT_LEGACY_MESSAGE
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
  onNeedsLegacyReconnectTap,
  eraseDisabled = false,
  reconnectOpen = false,
  onReconnectOpenChange,
  reconnectEmail = '',
  reconnectPassword = '',
  onReconnectEmailChange,
  onReconnectPasswordChange,
  onReconnectSubmit,
  reconnectBusy = false,
}: YourDataMealsErasePanelProps) {
  const signedOut = countMode === 'signed_out'
  const needsReconnect = countMode === 'needs_legacy_reconnect'
  const disabled =
    eraseDisabled ||
    signedOut ||
    needsReconnect ||
    countMode === 'unknown' ||
    countMode === 'none'

  return (
    <div className="space-y-2" data-testid="your-data-meals-section">
      <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        Tes données
      </p>
      <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80">
        <button
          type="button"
          data-testid="erase-old-meals-button"
          disabled={disabled && !signedOut && !needsReconnect}
          onClick={() => {
            if (signedOut) {
              onSignedOutTap?.()
              return
            }
            if (needsReconnect) {
              onNeedsLegacyReconnectTap?.()
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

      {needsReconnect && error ? (
        <p
          className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]"
          data-testid="erase-old-meals-reconnect-error"
        >
          {error}
        </p>
      ) : null}

      <IosSheet
        open={reconnectOpen && needsReconnect}
        onClose={() => {
          if (!reconnectBusy) onReconnectOpenChange?.(false)
        }}
        dismissible={!reconnectBusy}
        title="Ancien compte"
        subtitle="Lier pour effacer"
        leading={<Trash2 className="mt-0.5 h-5 w-5 text-[#FF453A]" />}
      >
        <div className="space-y-3 pb-2">
          <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
            {ERASE_MEALS_RECONNECT_LEGACY_MESSAGE}. Entre l’e-mail et le mot de passe de ton
            ancien compte.
          </p>
          <label className="block space-y-1">
            <span className="text-[12px] text-[#8E8E93]">E-mail</span>
            <input
              data-testid="erase-legacy-reconnect-email"
              type="email"
              autoComplete="username"
              value={reconnectEmail}
              onChange={(e) => onReconnectEmailChange?.(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[15px] text-white outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] text-[#8E8E93]">Mot de passe</span>
            <input
              data-testid="erase-legacy-reconnect-password"
              type="password"
              autoComplete="current-password"
              value={reconnectPassword}
              onChange={(e) => onReconnectPasswordChange?.(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[15px] text-white outline-none"
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="erase-legacy-reconnect-submit"
            disabled={reconnectBusy || !reconnectEmail.trim() || !reconnectPassword}
            onClick={() => void onReconnectSubmit?.()}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {reconnectBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Liaison…
              </>
            ) : (
              'Lier mon ancien compte'
            )}
          </button>
        </div>
      </IosSheet>

      <IosSheet
        open={confirmOpen && !signedOut && !needsReconnect && !disabled}
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
  const [reconnectOpen, setReconnectOpen] = useState(false)
  const [reconnectEmail, setReconnectEmail] = useState('')
  const [reconnectPassword, setReconnectPassword] = useState('')
  const [reconnectBusy, setReconnectBusy] = useState(false)
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
      } else if (state.needsLegacyReconnect) {
        setCountMode('needs_legacy_reconnect')
        setServerCount(state.serverCount)
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
    countMode === 'unknown' ||
    countMode === 'none' ||
    countMode === 'signed_out' ||
    countMode === 'needs_legacy_reconnect'

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
      reconnectOpen={reconnectOpen}
      onReconnectOpenChange={(open) => {
        setError(null)
        setReconnectOpen(open)
      }}
      reconnectEmail={reconnectEmail}
      reconnectPassword={reconnectPassword}
      onReconnectEmailChange={setReconnectEmail}
      onReconnectPasswordChange={setReconnectPassword}
      reconnectBusy={reconnectBusy}
      onNeedsLegacyReconnectTap={() => {
        setConfirmOpen(false)
        setError(null)
        setReconnectOpen(true)
      }}
      onReconnectSubmit={async () => {
        setReconnectBusy(true)
        setError(null)
        try {
          await signInLegacySupabaseAndLink(reconnectEmail, reconnectPassword)
          setReconnectOpen(false)
          setReconnectPassword('')
          await refresh()
        } catch (err) {
          if (err instanceof EraseMealsNeedsLegacyReconnectError) {
            setError(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE)
          } else if (err instanceof EraseMealsPurgeError) {
            setError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
          } else {
            setError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
          }
        } finally {
          setReconnectBusy(false)
        }
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
          } else if (err instanceof EraseMealsNeedsLegacyReconnectError) {
            setError(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE)
            setCountMode('needs_legacy_reconnect')
            setConfirmOpen(false)
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
