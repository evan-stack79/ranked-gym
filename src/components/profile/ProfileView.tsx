import { useEffect, useState } from 'react'
import { LogOut, Settings, X } from 'lucide-react'
import { FighterHeader } from './FighterHeader'
import { RankShowcase } from './RankShowcase'
import { ProfileXPBar } from './ProfileXPBar'
import { StatGrid } from './StatGrid'
import { BadgeShowcase } from './BadgeShowcase'
import { useAuth } from '../../context/AuthContext'
import { getProfileProgress, saveProfileProgress } from '../../services/profileStorage'
import { getRankFromLevel } from '../../utils/rank'
import type { StoredProfileProgress } from '../../services/profileStorage'

export function ProfileView() {
  const { user, signOut, isAuthenticated, requireAuth } = useAuth()
  const [progress, setProgress] = useState<StoredProfileProgress>(() => getProfileProgress())
  const [hydrated, setHydrated] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setProgress(getProfileProgress())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) {
      saveProfileProgress(progress)
    }
  }, [progress, hydrated])

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-[17px] font-semibold text-white">Profil verrouillé</p>
        <p className="max-w-xs text-[15px] text-[#8E8E93]">
          Connecte-toi pour voir ton rank, ton XP et tes stats.
        </p>
        <button
          type="button"
          onClick={() => requireAuth(() => undefined)}
          className="btn-brand rounded-2xl border border-white/15 px-6 py-3.5 text-[15px] font-semibold text-white"
        >
          Créer mon profil
        </button>
      </div>
    )
  }

  const rank = getRankFromLevel(progress.level)
  const username = user.displayName

  return (
    <div className="flex flex-col gap-8 pb-4">
      <FighterHeader
        username={username}
        title={rank.title}
        level={progress.level}
        rank={rank.tier}
        email={user.email}
        provider={user.provider}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <RankShowcase rank={rank} level={progress.level} />
      <ProfileXPBar
        level={progress.level}
        currentXp={progress.currentXp}
        xpToNextLevel={progress.xpToNextLevel}
      />
      <StatGrid />
      <BadgeShowcase />

      {settingsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Fermer les paramètres"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-lg rounded-t-[28px] border border-white/10 bg-[#1C1C1E] p-5 sm:mx-4 sm:rounded-[28px]"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#8E8E93]" />
                <h2 className="text-[17px] font-semibold text-white">Paramètres</h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[#8E8E93]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="glass-card mb-4 rounded-2xl p-4">
              <p className="text-[13px] text-[#8E8E93]">Compte connecté</p>
              <p className="mt-1 font-semibold text-white">{user.displayName}</p>
              <p className="mt-0.5 text-[13px] text-[#AEAEB2]">{user.email}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-[#636366]">
                Via {user.provider}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false)
                signOut()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/15 py-3.5 text-[16px] font-semibold text-[#FF453A] active:opacity-80"
            >
              <LogOut className="h-5 w-5" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
