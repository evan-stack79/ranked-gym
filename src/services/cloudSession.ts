/** Shared auth user id for scoping local cache + cloud sync (no import cycles). */

let activeUserId: string | null = null

export function getActiveCloudUserId(): string | null {
  return activeUserId
}

export function setActiveCloudUserId(userId: string | null): void {
  const prev = activeUserId
  activeUserId = userId
  if (prev !== userId && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ranked-gym:training-scope-changed', {
        detail: { previous: prev, next: userId },
      }),
    )
  }
}
