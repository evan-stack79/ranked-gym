import type { ReactElement, SVGProps } from 'react'
import {
  FOOD_ICON_CATEGORY_LABELS,
  FOOD_ICON_STROKE,
  resolveFoodIconCategory,
  type FoodIconCategoryId,
} from '../../utils/foodIconCategory'

type SvgProps = SVGProps<SVGSVGElement>

function baseProps(props: SvgProps): SvgProps {
  return {
    viewBox: '0 0 48 48',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    ...props,
  }
}

const stroke = {
  stroke: FOOD_ICON_STROKE,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Icônes SVG locales — trait #FF2B2B, pas de fill brillant / glow. */
const ICONS: Record<FoodIconCategoryId, (p: SvgProps) => ReactElement> = {
  viennoiserie: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M10 30c2-10 8-16 14-16s12 6 14 16" />
      <path {...stroke} d="M12 30h24c1 4-2 8-6 8H18c-4 0-7-4-6-8z" />
      <path {...stroke} d="M18 22c2 2 4 3 6 3s4-1 6-3" />
    </svg>
  ),
  pain: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M12 20c0-6 5-10 12-10s12 4 12 10v12c0 3-3 6-6 6H18c-3 0-6-3-6-6V20z" />
      <path {...stroke} d="M18 18c2-2 4-3 6-3s4 1 6 3" />
      <path {...stroke} d="M16 28h16M16 33h12" />
    </svg>
  ),
  produit_laitier: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M18 10h12l3 6v20a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V16l3-6z" />
      <path {...stroke} d="M17 16h14" />
      <path {...stroke} d="M22 24h4v10h-4z" />
    </svg>
  ),
  fruit: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M24 16c-7 0-12 6-12 13 0 6 5 11 12 11s12-5 12-11c0-7-5-13-12-13z" />
      <path {...stroke} d="M24 16c0-4 3-7 6-8" />
      <path {...stroke} d="M24 16c-1 3-1 6 0 9" />
    </svg>
  ),
  legume: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M24 38c-6 0-10-5-10-12 0-8 5-16 10-18 5 2 10 10 10 18 0 7-4 12-10 12z" />
      <path {...stroke} d="M24 8v6M20 12c2 1 4 1 6 0" />
    </svg>
  ),
  viande: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M14 20c0-5 4-9 10-9s10 4 10 9c0 8-4 14-10 18-6-4-10-10-10-18z" />
      <path {...stroke} d="M20 22c1 3 3 5 4 6 1-1 3-3 4-6" />
    </svg>
  ),
  poisson: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M8 24c8-10 16-12 24-8 2 8 2 12 0 20-8 4-16 2-24-8z" />
      <path {...stroke} d="M32 16l8-4v20l-8-4" />
      <circle cx="18" cy="22" r="1.5" fill={FOOD_ICON_STROKE} />
    </svg>
  ),
  boisson: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M16 10h16l-2 28H18L16 10z" />
      <path {...stroke} d="M18 20h12" />
      <path {...stroke} d="M22 6h4" />
    </svg>
  ),
  plat: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M10 28h28a10 10 0 0 1-28 0z" />
      <path {...stroke} d="M14 28c1-8 5-14 10-14s9 6 10 14" />
      <path {...stroke} d="M18 38h12" />
    </svg>
  ),
  snack: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M14 18c0-4 4-8 10-8s10 4 10 8-4 8-10 8-10-4-10-8z" />
      <path {...stroke} d="M16 24c2 8 4 14 8 16 4-2 6-8 8-16" />
      <path {...stroke} d="M20 18h8M22 14h4" />
    </svg>
  ),
  autre: (p) => (
    <svg {...baseProps(p)}>
      <path {...stroke} d="M16 14h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" />
      <path {...stroke} d="M20 22h8M20 28h6" />
    </svg>
  ),
}

interface FoodCategoryIconProps {
  category?: FoodIconCategoryId | null
  categoriesTags?: string[] | null
  size?: number
  className?: string
  /** Accessible name — défaut = libellé catégorie. */
  label?: string
}

/**
 * Icône catégorie V3 (remplace les photos OFF contributeurs).
 * Fond sombre sobre, trait #FF2B2B, pas d’effet brillant.
 */
export function FoodCategoryIcon({
  category,
  categoriesTags,
  size = 72,
  className = '',
  label,
}: FoodCategoryIconProps) {
  const id = category ?? resolveFoodIconCategory(categoriesTags)
  const Icon = ICONS[id]
  const aria = label ?? FOOD_ICON_CATEGORY_LABELS[id]

  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-[#2C2C2E] ${className}`}
      style={{ width: size, height: size }}
      data-food-category-icon={id}
      role="img"
      aria-label={aria}
    >
      <Icon width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} />
    </span>
  )
}
