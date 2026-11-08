/** Icône plate verre 25 cl — style Lucide / UI Ranked Gym (pas de 3D). */

export function FlatGlassIcon({
  filled,
  size = 18,
}: {
  filled: boolean
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M7 3.5h10l-1.2 15.2a2.2 2.2 0 0 1-2.2 2H10.4a2.2 2.2 0 0 1-2.2-2L7 3.5Z"
        stroke={filled ? '#5AC8FA' : '#8E8E93'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {filled ? (
        <path
          d="M8.1 11.5h7.8l-.55 7a1.1 1.1 0 0 1-1.1.98h-4.5a1.1 1.1 0 0 1-1.1-.98L8.1 11.5Z"
          fill="#5AC8FA"
          fillOpacity="0.55"
        />
      ) : null}
      <path
        d="M6.5 3.5h11"
        stroke={filled ? '#5AC8FA' : '#8E8E93'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
