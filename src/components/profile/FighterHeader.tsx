import { useRef, useState } from 'react'
import { Pencil, Settings } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { StatusBadge, statusFromPower } from '../ui/StatusBadge'
import type { AuthMethod } from '../../services/authService'
import { uploadUserAvatar } from '../../services/avatarService'

interface FighterHeaderProps {
  username: string
  title: string
  level: number
  rank: string
  email?: string
  provider?: AuthMethod
  disciplineLabel?: string
  disciplineAccent?: string
  avatarUrl?: string | null
  userId?: string
  onAvatarUpdated?: (url: string) => void
  onOpenSettings?: () => void
}

export function FighterHeader({
  username,
  title,
  level,
  rank,
  email,
  provider,
  disciplineLabel,
  disciplineAccent = '#FF2B2B',
  avatarUrl,
  userId,
  onAvatarUpdated,
  onOpenSettings,
}: FighterHeaderProps) {
  const status = statusFromPower(level, rank)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayUrl = previewUrl || avatarUrl || null
  const canEdit = Boolean(userId)

  const openPicker = () => {
    if (!canEdit || uploading) return
    setError(null)
    inputRef.current?.click()
  }

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setUploading(true)
    setError(null)

    try {
      const { publicUrl } = await uploadUserAvatar(userId, file)
      setPreviewUrl(publicUrl)
      onAvatarUpdated?.(publicUrl)
    } catch (err) {
      setPreviewUrl(null)
      const message = err instanceof Error ? err.message : 'Upload impossible.'
      setError(message)
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={openPicker}
            disabled={!canEdit || uploading}
            className="ios-press relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/55 disabled:opacity-100"
            aria-label={canEdit ? 'Changer la photo de profil' : `Avatar de ${username}`}
          >
            <Avatar
              username={username}
              imageUrl={displayUrl}
              size="lg"
              loading={uploading}
              className="ring-2 ring-[#FF2B2B]/40"
            />
            {canEdit ? (
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#2C2C2E] text-white shadow-[0_4px_12px_rgb(0_0_0_/0.45)]"
                aria-hidden
              >
                <Pencil className="h-3 w-3" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={onFileChange}
            tabIndex={-1}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-white">{username}</h1>
            {status && <StatusBadge variant={status} />}
          </div>
          <p className="mt-0.5 text-[15px] text-[#8E8E93]">{title}</p>
          {disciplineLabel && (
            <span
              className="mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
              style={{
                background: `${disciplineAccent}22`,
                borderColor: `${disciplineAccent}55`,
                color: disciplineAccent,
              }}
            >
              {disciplineLabel}
            </span>
          )}
          {email && (
            <p className="mt-1 text-[12px] text-[#636366]">
              {email}
              {provider ? ` · ${provider}` : ''}
            </p>
          )}
          {error ? (
            <p className="mt-1 max-w-[220px] text-[12px] leading-snug text-[#FF453A]">{error}</p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="glass-card flex h-10 w-10 items-center justify-center rounded-full text-[#8E8E93] transition-colors active:opacity-80"
        aria-label="Paramètres"
      >
        <Settings className="h-5 w-5" />
      </button>
    </header>
  )
}
