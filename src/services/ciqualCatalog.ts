/**
 * Catalogue « Aliments de base » — Table Ciqual 2020 (ANSES).
 * Colonne seule : Energie, Règlement UE N° 1169/2011 (kcal/100 g).
 * Aliments sans kcal exclus (OFF prend le relais). Vide ≠ 0.
 *
 * Données issues d’une copie archivée (ciqual.anses.fr en maintenance le 22/10/2026).
 * Avant mise en ligne : retélécharger depuis le site officiel ANSES / data.gouv.fr.
 */
import { isCiqualEnabled } from '../backend/ciqualFeatureFlag'
import {
  resolveFoodIconCategory,
  type FoodIconCategoryId,
} from '../utils/foodIconCategory'
import rawRows from '../data/ciqualKcal2020.json'
import { parseCiqualKcalTeneur } from './ciqualParse'

export const CIQUAL_SOURCE_ATTRIBUTION = 'Source : ANSES, table Ciqual 2020' as const

/** Mention licence / table (validation scientifique). */
export const CIQUAL_SOURCE_ATTRIBUTION_LONG =
  'Source : ANSES, table de composition nutritionnelle Ciqual 2020' as const

export type FoodHitSource = 'ciqual' | 'open_food_facts'

export type CiqualJsonRow = {
  ciqualCode: string
  nom: string
  grp: string
  ssgrp: string
  caloriesPer100g: number
}

/**
 * Entrée Ciqual pour l’UI V3.
 * calories = kcal/100 g UE 1169 (toujours > 0 dans ce catalogue filtré).
 */
export type CiqualBaseFood = {
  id: string
  barcode: string
  nom: string
  brands: ''
  /** kcal / 100 g — jamais null dans la liste exposée (absents exclus). */
  calories: number
  proteines: null
  glucides: null
  lipides: null
  servingSize: null
  categoriesTags: string[]
  foodIconCategory: FoodIconCategoryId
  provenance: 'ciqual'
  ciqualCode: string
  fetchedAt: number
}

function iconFromCiqualRow(row: CiqualJsonRow): FoodIconCategoryId {
  const nom = row.nom.toLowerCase()
  const ss = row.ssgrp
  // Heuristiques nom / sous-groupe avant tags OFF synthétiques.
  if (
    /croissant|brioche|pain au chocolat|viennoiser|chausson|pain aux raisins/.test(nom) ||
    ss === '0705'
  ) {
    return 'viennoiserie'
  }
  if (/^pain\b|baguette|mie\b|biscotte/.test(nom) || ss === '0302') {
    return 'pain'
  }
  if (row.grp === '05' || /yaourt|yogourt|fromage|lait\b|crème|beurre/.test(nom)) {
    return 'produit_laitier'
  }
  if (row.grp === '06' || /eau\b|jus |soda|boisson|thé|café|bière|vin\b/.test(nom)) {
    return 'boisson'
  }
  if (row.grp === '04') {
    if (/poisson|saumon|thon|cabillaud|crevette|moule|fruit de mer/.test(nom)) return 'poisson'
    return 'viande'
  }
  if (row.grp === '02') {
    if (
      /tomate|carotte|salade|courgette|brocoli|haricot|légume|pomme de terre|oignon|poivron/.test(
        nom,
      )
    ) {
      return 'legume'
    }
    return 'fruit'
  }
  if (row.grp === '01') return 'plat'
  if (row.grp === '07' || row.grp === '08') return 'snack'
  // Repli via tags synthétiques + resolve.
  return resolveFoodIconCategory(syntheticOffTagsForCiqual(row))
}

function syntheticOffTagsForCiqual(row: CiqualJsonRow): string[] {
  switch (row.grp) {
    case '01':
      return ['en:meals']
    case '02':
      return ['en:fruits', 'en:vegetables']
    case '03':
      return ['en:breads']
    case '04':
      return ['en:meats']
    case '05':
      return ['en:dairies']
    case '06':
      return ['en:beverages']
    case '07':
    case '08':
      return ['en:snacks']
    default:
      return []
  }
}

function rowToFood(row: CiqualJsonRow): CiqualBaseFood | null {
  // Ceinture : re-valider la teneur (jamais 0 / absent).
  const kcal = parseCiqualKcalTeneur(String(row.caloriesPer100g).replace('.', ','))
  if (kcal == null) return null
  const icon = iconFromCiqualRow(row)
  const tags = syntheticOffTagsForCiqual(row)
  return {
    id: `ciqual:${row.ciqualCode}`,
    barcode: `ciqual:${row.ciqualCode}`,
    nom: row.nom,
    brands: '',
    calories: kcal,
    proteines: null,
    glucides: null,
    lipides: null,
    servingSize: null,
    categoriesTags: tags,
    foodIconCategory: icon,
    provenance: 'ciqual',
    ciqualCode: row.ciqualCode,
    fetchedAt: 0,
  }
}

const ALL_ROWS = rawRows as CiqualJsonRow[]

let cachedFoods: CiqualBaseFood[] | null = null

function allCiqualFoods(): CiqualBaseFood[] {
  if (cachedFoods) return cachedFoods
  const out: CiqualBaseFood[] = []
  for (const row of ALL_ROWS) {
    const food = rowToFood(row)
    if (food) out.push(food)
  }
  cachedFoods = out
  return out
}

/**
 * Aliments de base pour la section V3.
 * Flag OFF → []. Absents kcal exclus du JSON (et refiltrés ici).
 */
export function listCiqualBaseFoods(options?: {
  term?: string
  enabled?: boolean
  limit?: number
}): CiqualBaseFood[] {
  const enabled = options?.enabled ?? isCiqualEnabled()
  if (!enabled) return []
  const term = options?.term?.trim().toLowerCase() ?? ''
  const limit = options?.limit ?? 40
  const all = allCiqualFoods()
  const filtered = !term
    ? all
    : all.filter((row) => row.nom.toLowerCase().includes(term))
  // Pertinence légère : préfixe / exact avant « contient ».
  const ranked = [...filtered].sort((a, b) => {
    if (!term) return a.nom.localeCompare(b.nom, 'fr')
    const an = a.nom.toLowerCase()
    const bn = b.nom.toLowerCase()
    const score = (n: string) => {
      if (n === term) return 0
      const head = n.split(',')[0]?.trim() ?? n
      // « Croissant, sans précision » avant « Croissant au beurre… »
      if (head === term) return 1
      if (n.startsWith(`${term},`) || n.startsWith(`${term} `)) return 2
      if (head.startsWith(term)) return 3
      if (n.includes(term)) return 4
      return 5
    }
    const d = score(an) - score(bn)
    return d !== 0 ? d : an.localeCompare(bn, 'fr')
  })
  return ranked.slice(0, Math.max(0, limit))
}

export function findCiqualByExactName(nom: string): CiqualBaseFood | null {
  const wanted = nom.trim().toLowerCase()
  if (!wanted) return null
  return allCiqualFoods().find((f) => f.nom.toLowerCase() === wanted) ?? null
}

export function ciqualCatalogSize(): number {
  return allCiqualFoods().length
}
