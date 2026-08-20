import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  getCloudBackupMeta,
  pullCloudBackup,
  pushCloudBackup,
  subscribeCloudBackup,
  type CloudBackupMeta,
} from '../../services/cloudBackup'

function formatWhen(iso: string | null): string {
  if (!iso) return 'Jamais'
  try {
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
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => subscribeCloudBackup(setMeta), [])

  const showFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 3500)
  }

  const runPush = () => {
    if (!user) {
      requireAuth(() => undefined)
      return
    }
    setBusy('push')
    void pushCloudBackup(user.id).then((r) => {
      setBusy(null)
      showFlash(r.ok ? 'Sauvegarde cloud OK' : r.error ?? 'Échec')
    })
  }

  const runPull = () => {
    if (!user) {
      requireAuth(() => undefined)
      return
    }
    setBusy('pull')
    void pullCloudBackup(user.id).then((r) => {
      setBusy(null)
      if (!r.ok) {
        showFlash(r.error ?? 'Échec')
        return
      }
      showFlash(r.applied ? 'Données restaurées depuis le cloud' : 'Cloud à jour (rien à restaurer)')
    })
  }

  if (!isAuthenticated) {
    return (
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/8 p-2.5">
            <CloudOff className="h-5 w-5 text-[#8E8E93]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-white">Sauvegarde cloud</p>
            <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
              Connecte-toi pour synchroniser Nutri, Train, Force et retrouver tout sur un autre
              téléphone.
            </p>
            <button
              type="button"
              onClick={() => requireAuth(() => undefined)}
              className="ios-press mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-[14px] font-semibold text-white"
            >
              Se connecter
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#30D158]/15 p-2.5">
          <Cloud className="h-5 w-5 text-[#30D158]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-semibold text-white">Sauvegarde cloud</p>
            {meta.pending || busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#8E8E93]" />
            ) : null}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
            Nutri, séances, carnet, agenda et Force — sync auto dès que tu modifies quelque chose.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <dt className="text-[#636366]">Dernière sync</dt>
              <dd className="mt-0.5 font-medium text-[#AEAEB2]">{formatWhen(meta.lastPushAt)}</dd>
            </div>
            <div>
              <dt className="text-[#636366]">Dernière restaure</dt>
              <dd className="mt-0.5 font-medium text-[#AEAEB2]">{formatWhen(meta.lastPullAt)}</dd>
            </div>
          </dl>
          {meta.lastError ? (
            <p className="mt-2 text-[12px] leading-snug text-[#FF453A]">{meta.lastError}</p>
          ) : null}
          {flash ? (
            <p className="mt-2 text-[12px] font-medium text-[#30D158]">{flash}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={runPush}
              className="ios-press inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Sauvegarder
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={runPull}
              className="ios-press inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-transparent px-3.5 py-2.5 text-[13px] font-semibold text-[#AEAEB2] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Restaurer
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
