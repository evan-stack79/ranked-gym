import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import { fetchConvexProfile, updateConvexProfileProgress } from './convexProfileService'
import type { ProfileRow } from '../types/database'

const api = generatedApi as any

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Private avatar upload via Convex file storage (user_files).
 * Scaffolding for PR-H; enabled only when Convex is the active cloud backend.
 */
export async function uploadConvexUserAvatar(
  userId: string,
  blob: Blob,
): Promise<{ profile: ProfileRow; publicUrl: string }> {
  const sessionToken = await requireToken()
  const client = getConvex()
  const { uploadUrl } = (await client.mutation(api.files.generateAvatarUploadUrl, {
    sessionToken,
  })) as { uploadUrl: string }

  const bytes = await blob.arrayBuffer()
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: bytes,
  })
  if (!uploadResponse.ok) {
    throw new Error('CONVEX_AVATAR_UPLOAD_FAILED')
  }
  const uploaded = (await uploadResponse.json()) as { storageId?: string }
  if (!uploaded.storageId) {
    throw new Error('CONVEX_AVATAR_STORAGE_ID_MISSING')
  }

  const committed = (await client.mutation(api.files.commitAvatarUpload, {
    sessionToken,
    storageId: uploaded.storageId,
    contentType: blob.type || 'image/jpeg',
    sizeBytes: blob.size,
    sha256: await sha256Hex(bytes),
  })) as { url: string | null }

  const publicUrl = committed.url ?? ''
  if (publicUrl) {
    await updateConvexProfileProgress(userId, { avatar_url: publicUrl })
  }
  const profile = (await fetchConvexProfile(userId)) ?? (await updateConvexProfileProgress(userId, {}))
  return { profile: { ...profile, avatar_url: publicUrl || profile.avatar_url }, publicUrl }
}

export async function getConvexOwnAvatarUrl(): Promise<string | null> {
  const sessionToken = await requireToken()
  const file = (await getConvex().query(api.files.getOwnAvatar, {
    sessionToken,
  })) as { url: string | null } | null
  return file?.url ?? null
}
