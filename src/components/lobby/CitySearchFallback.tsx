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
      <p className="mb-3 text-center text-[15px] text-[#8E8E93]">Ou entre ta ville manuellement</p>

      <form onSubmit={handleSubmit} className="glass-card flex items-center gap-2 rounded-2xl p-2 pl-4">
        <Search className="h-5 w-5 shrink-0 text-[#0A84FF]" strokeWidth={1.75} />
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Tergnier, Paris, Lyon…"
          disabled={disabled || loading}
          className="min-w-0 flex-1 bg-transparent py-3 text-[17px] text-white placeholder:text-[#48484A] focus:outline-none disabled:opacity-50"
          aria-label="Nom de la ville"
        />
        <button
          type="submit"
          disabled={disabled || loading || city.trim().length < 2}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0A84FF] text-white transition-opacity disabled:opacity-40"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </div>
  )
}
