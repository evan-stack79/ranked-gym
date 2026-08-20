import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  getCloudBackupMeta,
  subscribeCloudBackup,
  type CloudBackupMeta,
} from '../../services/cloudBackup'

function formatWhen(iso: string | null): string {
  if (!iso) return 'pas encore'
  try {
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
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
  const { isAuthenticated, requireAuth } = useAuth()
  const [meta, setMeta] = useState<CloudBackupMeta>(() => getCloudBackupMeta())

  useEffect(() => subscribeCloudBackup(setMeta), [])

  if (!isAuthenticated) {
    return (
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/8 p-2.5">
            <CloudOff className="h-5 w-5 text-[#8E8E93]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-white">Sauvegarde auto</p>
            <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
              Connecte-toi une fois : chaque repas, séance ou réglage est enregistré tout seul dans
              le cloud. Plus rien à faire à la main.
            </p>
            <button
              type="button"
              onClick={() => requireAuth(() => undefined)}
              className="ios-press mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-[14px] font-semibold text-white"
            >
              Activer la sauvegarde auto
            </button>
          </div>
        </div>
      </section>
    )
  }

  const saving = meta.pending
  const ok = Boolean(meta.lastPushAt) && !meta.lastError

  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${ok ? 'bg-[#30D158]/15' : 'bg-white/8'}`}>
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#8E8E93]" />
          ) : (
            <Cloud className={`h-5 w-5 ${ok ? 'text-[#30D158]' : 'text-[#8E8E93]'}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-white">Sauvegarde auto</p>
          <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
            {saving
              ? 'Enregistrement en cours…'
              : `Chaque modification est sauvegardée toute seule. Dernière fois : ${formatWhen(meta.lastPushAt)}.`}
          </p>
          {meta.lastError ? (
            <p className="mt-2 text-[12px] leading-snug text-[#FF453A]">{meta.lastError}</p>
          ) : (
            <p className="mt-2 text-[12px] font-medium text-[#30D158]">
              Aucun bouton — c’est déjà automatique.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
