import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  getCloudBackupMeta,
  pullCloudBackup,
  pushCloudBackup,
  subscribeCloudBackup,
  type CloudBackupMeta,
} from '../../services/cloudBackup'

function formatWhen(iso: string | null): string {
  if (!iso) return 'pas encore'
  try {
    const t = Date.parse(iso)
    const mins = Math.round((Date.now() - t) / 60000)
    if (mins < 1) return 'à l’instant'
    if (mins < 60) return `il y a ${mins} min`
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function CloudBackupCard() {
  const { user, isAuthenticated, requireAuth } = useAuth()
  const [meta, setMeta] = useState<CloudBackupMeta>(() => getCloudBackupMeta())
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => subscribeCloudBackup(setMeta), [])

  const showFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 4000)
  }

  const syncNow = () => {
    if (!user) {
      requireAuth(() => undefined)
      return
    }
    setBusy(true)
    void (async () => {
      const pull = await pullCloudBackup(user.id)
      if (!pull.ok) {
        setBusy(false)
        showFlash(pull.error ?? 'Sync impossible')
        return
      }
      const push = await pushCloudBackup(user.id)
      setBusy(false)
      if (!push.ok) {
        showFlash(push.error ?? 'Envoi impossible')
        return
      }
      showFlash(
        pull.applied
          ? 'OK — données récupérées puis resauvegardées'
          : 'OK — tout est synchronisé',
      )
    })()
  }

  if (!isAuthenticated) {
    return (
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/8 p-2.5">
            <CloudOff className="h-5 w-5 text-[#8E8E93]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-white">Sauvegarde</p>
            <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
              Connecte-toi une fois : Nutri, Train et Force se synchronisent tout seuls. Même après
              un nouveau lien, tu retrouves tout.
            </p>
            <button
              type="button"
              onClick={() => requireAuth(() => undefined)}
              className="ios-press mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-[14px] font-semibold text-white"
            >
              Se connecter pour sauvegarder
            </button>
          </div>
        </div>
      </section>
    )
  }

  const ok = Boolean(meta.lastPushAt) && !meta.lastError
  const statusLabel = meta.pending || busy
    ? 'Synchronisation…'
    : meta.lastError
      ? 'Attention'
      : ok
        ? 'À jour'
        : 'Prêt'

  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-xl p-2.5 ${ok ? 'bg-[#30D158]/15' : 'bg-white/8'}`}
        >
          <Cloud className={`h-5 w-5 ${ok ? 'text-[#30D158]' : 'text-[#8E8E93]'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-semibold text-white">Sauvegarde</p>
            {(meta.pending || busy) && (
              <Loader2 className="h-4 w-4 animate-spin text-[#8E8E93]" />
            )}
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                meta.lastError
                  ? 'bg-[#FF453A]/15 text-[#FF453A]'
                  : ok
                    ? 'bg-[#30D158]/15 text-[#30D158]'
                    : 'bg-white/8 text-[#8E8E93]'
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
            Sync automatique. Dernière sauvegarde : {formatWhen(meta.lastPushAt)}.
          </p>
          {meta.lastError ? (
            <p className="mt-2 text-[12px] leading-snug text-[#FF453A]">{meta.lastError}</p>
          ) : null}
          {flash ? (
            <p className="mt-2 text-[12px] font-medium text-[#30D158]">{flash}</p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={syncNow}
            className="ios-press mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Synchroniser maintenant
          </button>
        </div>
      </div>
    </section>
  )
}
