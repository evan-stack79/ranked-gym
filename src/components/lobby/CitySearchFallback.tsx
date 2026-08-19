import { Search, ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'

interface CitySearchFallbackProps {
  onSearch: (city: string) => void
  disabled?: boolean
  loading?: boolean
}

export function CitySearchFallback({ onSearch, disabled = false, loading = false }: CitySearchFallbackProps) {
  const [city, setCity] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = city.trim()
    if (trimmed.length < 2 || disabled || loading) return
    onSearch(trimmed)
  }

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-sm text-slate-500">Ou entre ta ville manuellement</p>

      <form onSubmit={handleSubmit} className="gradient-border">
        <div className="flex items-center gap-2 rounded-2xl bg-anthracite p-2 pl-4">
          <Search className="h-5 w-5 shrink-0 text-neon-blue" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex : Tergnier, Paris, Lyon..."
            disabled={disabled || loading}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
            aria-label="Nom de la ville"
          />
          <button
            type="submit"
            disabled={disabled || loading || city.trim().length < 2}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-neon-blue/15 px-4 py-3 text-sm font-semibold text-neon-blue transition-all hover:bg-neon-blue/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? '...' : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
