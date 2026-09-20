import { useEffect, useState } from 'react'

function readOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

/** Connexion réseau — pour un indicateur UI non bloquant. Ne coupe aucun fetch. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(readOnline)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
