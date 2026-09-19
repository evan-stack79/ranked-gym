import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import type { CatalogExercise } from '../../data/exerciseCatalog'
import { formatCatalogMeta } from '../../data/exerciseCatalog'
import {
  countExerciseMatches,
  searchExercises,
} from '../../utils/exerciseSearch'
import { resolveExerciseMedia } from '../../utils/exerciseMedia'
import { BRAND_MARK_COMPACT_SRC } from '../brand/BrandMark'

export type ExercisePickerMode = 'first' | 'add'

export interface ExercisePickerProps {
  mode: ExercisePickerMode
  onBack: () => void
  onSelect: (exercise: CatalogExercise) => void
  onCreateCustom: (name: string) => void
}

const INITIAL_LIMIT = 8

/**
 * Sélecteur d’exercice plein écran — démarrage vide ou bouton +.
 * Pas de « Séance libre », pas de bascule programme, pas de bottom nav.
 */
export function ExercisePicker({
  mode,
  onBack,
  onSelect,
  onCreateCustom,
}: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const results = useMemo(
    () => searchExercises(query, { limit: INITIAL_LIMIT }),
    [query],
  )
  const totalMatches = useMemo(() => countExerciseMatches(query), [query])

  useEffect(() => {
    // Focus search after paint — clavier web OK, résultats visibles au-dessus.
    const t = window.setTimeout(() => searchRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [])

  const title =
    mode === 'add' ? 'Ajouter un exercice' : 'Quel est ton premier exercice ?'
  const subtitle =
    mode === 'add'
      ? 'Choisis un mouvement à ajouter.'
      : 'Choisis un mouvement pour commencer.'

  const submitCustom = () => {
    const name = customName.trim()
    if (!name) return
    onCreateCustom(name)
  }

  return (
    <section
      className="flex min-h-[100dvh] flex-col bg-black text-white"
      data-exercise-picker
      data-picker-mode={mode}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top chrome — logo panthère seul, pas de wordmark / pas de bascule programme */}
      <div className="relative flex items-center justify-center px-3 pb-1 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="ios-press absolute left-3 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e] text-white"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <img
          src={BRAND_MARK_COMPACT_SRC}
          width={32}
          height={32}
          alt=""
          aria-hidden="true"
          className="h-8 w-8 object-contain"
          draggable={false}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-8">
        <header className="mb-5 shrink-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-[#8E8E93]">
            {subtitle}
          </p>
        </header>

        {/* Search — graphite, coins modérés */}
        <label
          className="mb-2 flex min-h-12 shrink-0 items-center gap-2.5 rounded-2xl bg-[#2c2c2e] px-3.5"
          htmlFor={`${listId}-search`}
        >
          <Search className="h-5 w-5 shrink-0 text-[#8E8E93]" aria-hidden="true" />
          <input
            ref={searchRef}
            id={`${listId}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un exercice"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label="Rechercher un exercice"
            aria-controls={listId}
            className="min-h-11 w-full bg-transparent text-[16px] text-white placeholder:text-[#636366] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#AEAEB2]"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          ) : null}
        </label>

        {/* Results — lignes sobres, scroll au-dessus du clavier */}
        <ul
          id={listId}
          role="listbox"
          aria-label="Résultats d’exercices"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(keyboard-inset-height,0px)] [-webkit-overflow-scrolling:touch]"
        >
          {results.map((ex, index) => (
            <ExerciseResultRow
              key={ex.id}
              exercise={ex}
              active={index === 0}
              onSelect={() => onSelect(ex)}
            />
          ))}
          {results.length === 0 ? (
            <li className="px-1 py-8 text-center text-[14px] text-[#8E8E93]">
              Aucun exercice trouvé
            </li>
          ) : null}
        </ul>

        {/* Footer */}
        <div className="shrink-0 pt-2">
          {customOpen ? (
            <div className="mb-3 space-y-2">
              <label className="block">
                <span className="sr-only">Nom de l’exercice personnalisé</span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nom de ton exercice"
                  autoFocus
                  className="min-h-11 w-full rounded-xl border border-white/12 bg-[#1c1c1e] px-3.5 text-[15px] text-white placeholder:text-[#636366] outline-none focus-visible:border-[#FF2B2B]/55"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCustom()
                  }}
                />
              </label>
              <button
                type="button"
                onClick={submitCustom}
                disabled={!customName.trim()}
                className="ios-press flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FF2B2B] text-[14px] font-semibold text-white disabled:opacity-40"
              >
                Créer et ajouter
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCustomOpen(true)
                setCustomName(query.trim())
              }}
              className="ios-press mb-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-[14px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Créer un exercice personnalisé
            </button>
          )}
          <p
            className="pb-1 text-center text-[12px] tabular-nums text-[#636366]"
            aria-live="polite"
            data-result-count
          >
            {totalMatches} résultat{totalMatches === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </section>
  )
}

function ExerciseResultRow({
  exercise,
  active,
  onSelect,
}: {
  exercise: CatalogExercise
  active: boolean
  onSelect: () => void
}) {
  const media = resolveExerciseMedia({
    name: exercise.name,
    canonicalExerciseId: exercise.id,
  })
  const meta = formatCatalogMeta(exercise)

  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        onClick={onSelect}
        data-exercise-id={exercise.id}
        data-result-active={active ? 'true' : 'false'}
        className="ios-press relative flex min-h-14 w-full items-center gap-3 border-b border-[#2c2c2e] py-3.5 pl-3.5 pr-1 text-left"
      >
        {active ? (
          <span
            className="absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full bg-[#FF2B2B]"
            aria-hidden="true"
          />
        ) : null}

        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#1c1c1e]">
          {media.imageSrc ? (
            <img
              src={media.imageSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-full w-full object-cover object-center grayscale contrast-[1.05]"
            />
          ) : (
            <span className="h-full w-full bg-[#2c2c2e]" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-white">{exercise.name}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#8E8E93]">{meta}</p>
        </div>

        <ChevronRight
          className="h-5 w-5 shrink-0 text-[#636366]"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </li>
  )
}
