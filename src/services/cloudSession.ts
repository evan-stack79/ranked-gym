/** Shared auth user id for scoping local cache + cloud sync (no import cycles). */

let activeUserId: string | null = null

export function getActiveCloudUserId(): string | null {
  return activeUserId
}

export function setActiveCloudUserId(userId: string | null): void {
  activeUserId = userId
}
