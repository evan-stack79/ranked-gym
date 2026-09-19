import type { ExerciseEquipment } from '../../data/exerciseCatalog'

type IllustrationKey = ExerciseEquipment | 'neutral'

/**
 * Glyphes SVG locaux par équipement — pas de photo inventée.
 * Remplace les rectangles gris du sélecteur quand aucun asset photo n’existe.
 */
export function ExerciseIllustration({
  kind,
  className = '',
}: {
  kind: IllustrationKey
  className?: string
}) {
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-[#1c1c1e] ${className}`}
      data-exercise-illustration={kind}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_40%,#3a3a3c_0%,transparent_72%)] opacity-80" />
      <svg
        viewBox="0 0 40 40"
        className="relative h-6 w-6 text-[#8E8E93]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph(kind)}
      </svg>
    </div>
  )
}

function glyph(kind: IllustrationKey) {
  switch (kind) {
    case 'Barre':
      return (
        <>
          <line x1="6" y1="20" x2="34" y2="20" />
          <rect x="4" y="16" width="4" height="8" rx="1" />
          <rect x="32" y="16" width="4" height="8" rx="1" />
        </>
      )
    case 'Haltères':
      return (
        <>
          <line x1="10" y1="20" x2="30" y2="20" />
          <rect x="7" y="14" width="5" height="12" rx="1" />
          <rect x="28" y="14" width="5" height="12" rx="1" />
        </>
      )
    case 'Machine':
      return (
        <>
          <rect x="10" y="10" width="20" height="20" rx="2" />
          <line x1="14" y1="16" x2="26" y2="16" />
          <line x1="14" y1="24" x2="26" y2="24" />
        </>
      )
    case 'Câble':
      return (
        <>
          <path d="M12 8v10c0 4 4 6 8 6s8-2 8-6V8" />
          <circle cx="20" cy="28" r="2.5" />
        </>
      )
    case 'Kettlebell':
      return (
        <>
          <path d="M14 16c0-4 3-7 6-7s6 3 6 7" />
          <ellipse cx="20" cy="26" rx="8" ry="7" />
        </>
      )
    case 'Poids du corps':
      return (
        <>
          <circle cx="20" cy="11" r="3.5" />
          <path d="M12 30l8-10 8 10" />
          <path d="M14 22h12" />
        </>
      )
    case 'Autre':
    case 'neutral':
    default:
      return (
        <>
          <circle cx="20" cy="20" r="9" />
          <path d="M14 20h12" />
        </>
      )
  }
}
