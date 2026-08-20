import { useEffect, useState } from 'react'
import { LogOut, Settings, X } from 'lucide-react'
import { FighterHeader } from './FighterHeader'
import { RankShowcase } from './RankShowcase'
import { ProfileXPBar } from './ProfileXPBar'
import { StatGrid } from './StatGrid'
import { BadgeShowcase } from './BadgeShowcase'
import { useAuth } from '../../context/AuthContext'
import { getRankFromLevel } from '../../utils/rank'

const XP_PER_LEVEL = 1000

export function ProfileView() {
  const { user, profile, signOut, isAuthenticated, requireAuth, refreshProfile } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      void refreshProfile()
    }
  }, [isAuthenticated, refreshProfile])

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

  const level = profile?.level ?? 1
  const currentXp = profile?.xp ?? 0
  const rank = getRankFromLevel(level)
  const username = profile?.pseudo || user.displayName

  return (
    <div className="flex flex-col gap-8 pb-4">
      <FighterHeader
        username={username}
        title={profile?.discipline ? `${rank.title} · ${profile.discipline}` : rank.title}
        level={level}
        rank={profile?.rank ?? rank.tier}
        email={user.email}
        provider={user.provider}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <RankShowcase rank={rank} level={level} />
      <ProfileXPBar
        level={level}
        currentXp={currentXp % XP_PER_LEVEL}
        xpToNextLevel={XP_PER_LEVEL}
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
              <p className="text-[13px] text-[#8E8E93]">Compte Supabase</p>
              <p className="mt-1 font-semibold text-white">{username}</p>
              <p className="mt-0.5 text-[13px] text-[#AEAEB2]">{user.email}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-[#636366]">
                {profile?.rank ?? rank.tier} · Niv. {level} · via {user.provider}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false)
                void signOut()
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
