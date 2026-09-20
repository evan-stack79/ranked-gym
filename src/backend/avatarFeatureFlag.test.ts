import { describe, expect, it, vi } from 'vitest'

vi.mock('./adapter', () => ({
  isConvexDomainActive: vi.fn(),
}))

vi.mock('./authFeatureFlag', () => ({
  getActiveAuthBackend: vi.fn(),
}))

import { getActiveAuthBackend } from './authFeatureFlag'
import { isConvexDomainActive } from './adapter'
import { isConvexAvatarStorageActive } from './avatarFeatureFlag'

describe('avatar feature flag', () => {
  it('stays on Supabase unless both Convex domain and Convex auth are active', () => {
    const domainActive = vi.mocked(isConvexDomainActive)
    const authBackend = vi.mocked(getActiveAuthBackend)

    domainActive.mockReturnValue(false)
    authBackend.mockReturnValue('convex')
    expect(isConvexAvatarStorageActive()).toBe(false)

    domainActive.mockReturnValue(true)
    authBackend.mockReturnValue('supabase')
    expect(isConvexAvatarStorageActive()).toBe(false)

    domainActive.mockReturnValue(true)
    authBackend.mockReturnValue('convex')
    expect(isConvexAvatarStorageActive()).toBe(true)
  })
})
