import { useEffect, useState } from 'react'
import { resolveHomeAreaNameAsync, resolveHomeAreaNameSync } from '../utils/homeLocation'

export function useHomeAreaName(): { areaName: string | null; loading: boolean } {
  const [areaName, setAreaName] = useState<string | null>(() => resolveHomeAreaNameSync())
  const [loading, setLoading] = useState(() => resolveHomeAreaNameSync() == null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const sync = resolveHomeAreaNameSync()
      if (sync) {
        setAreaName(sync)
        setLoading(false)
        return
      }

      setLoading(true)
      const resolved = await resolveHomeAreaNameAsync()
      if (cancelled) return
      setAreaName(resolved)
      setLoading(false)
    }

    void load()

    const onFocus = () => {
      void load()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return { areaName, loading }
}
