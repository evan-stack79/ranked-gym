/**
 * Verrouillage scroll body à compteur — sûr avec plusieurs sheets empilés / remounts.
 * Restaure exactement l’overflow précédent uniquement quand le dernier lock est libéré.
 */

let lockCount = 0
let savedBodyOverflow: string | null = null

/** @internal tests */
export function __resetBodyScrollLockForTests() {
  lockCount = 0
  savedBodyOverflow = null
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
}

/** @internal tests */
export function __getBodyScrollLockCountForTests() {
  return lockCount
}

export function acquireBodyScrollLock(): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  if (lockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1

  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0 && savedBodyOverflow !== null) {
      document.body.style.overflow = savedBodyOverflow
      savedBodyOverflow = null
    }
  }
}
