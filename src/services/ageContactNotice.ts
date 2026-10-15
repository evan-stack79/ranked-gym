const KEY = 'ranked-gym:age-contact-us'
export const AGE_CONTACT_US_EVENT = 'ranked-gym:age-contact-us'

export function markAgeContactUsNeeded(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AGE_CONTACT_US_EVENT))
  }
}

export function clearAgeContactUsNeeded(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function isAgeContactUsNeeded(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
