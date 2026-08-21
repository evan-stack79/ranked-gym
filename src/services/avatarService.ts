import { getSupabase } from '../lib/supabase'
import { updateProfileProgress } from './authService'
import type { ProfileRow } from '../types/database'

const MAX_EDGE_PX = 512
const JPEG_QUALITY = 0.85
const MAX_INPUT_BYTES = 12 * 1024 * 1024

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Impossible de lire cette image.'))
    }
    img.src = url
  })
}

/**
 * Redimensionne côté client (max 512²) → JPEG pour limiter la taille upload.
 */
export async function resizeImageForAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choisis une image (JPG, PNG, WEBP…).')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image trop lourde (max 12 Mo).')
  }

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible sur cet appareil.')

  ctx.fillStyle = '#1C1C1E'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob) throw new Error('Échec du redimensionnement.')
  return blob
}

function publicAvatarUrl(path: string): string {
  const supabase = getSupabase()
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the bubble refreshes immediately after overwrite
  const base = data.publicUrl
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}t=${Date.now()}`
}

/**
 * Upload avatar → bucket public `avatars/{userId}/avatar.jpg`
 * puis enregistre l’URL dans `profiles.avatar_url`.
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
): Promise<{ profile: ProfileRow; publicUrl: string }> {
  const blob = await resizeImageForAvatar(file)
  const path = `${userId}/avatar.jpg`
  const supabase = getSupabase()

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (uploadError) throw uploadError

  const publicUrl = publicAvatarUrl(path)
  const profile = await updateProfileProgress(userId, { avatar_url: publicUrl })
  return { profile, publicUrl }
}
