import type { SportCategory } from '../types/training'

/** Coarse app-level discipline (profile identity). */
export type AppDisciplineId =
  | 'musculation'
  | 'course'
  | 'football'
  | 'combat'
  | 'cyclisme'
  | 'crossfit'
  | 'fitness'

export type DisciplineFamily = 'strength' | 'endurance' | 'team' | 'combat' | 'hybrid'

export interface AppDiscipline {
  id: AppDisciplineId
  label: string
  shortLabel: string
  family: DisciplineFamily
  /** Maps to catalog sport id in trainingStorage */
  primarySportId: string
  accent: string
  /** Google Places nearbySearch queries */
  placeQueries: Array<{ type?: string; keyword?: string }>
  /** Mock lobby activity lines */
  lobbyActivities: string[]
  spotLabel: string
}

export const APP_DISCIPLINES: AppDiscipline[] = [
  {
    id: 'musculation',
    label: 'Musculation',
    shortLabel: 'Muscu',
    family: 'strength',
    primarySportId: 'musculation',
    accent: '#FF2B2B',
    placeQueries: [
      { type: 'gym' },
      { keyword: 'salle de musculation' },
      { keyword: 'fitness' },
    ],
    lobbyActivities: [
      'Développé couché 4×8',
      'Squat barre 5×5',
      'Tractions lestées',
      'Soulevé de terre',
    ],
    spotLabel: 'Salles & spots force',
  },
  {
    id: 'course',
    label: 'Course à pied',
    shortLabel: 'Course',
    family: 'endurance',
    primarySportId: 'course-a-pied',
    accent: '#30D158',
    placeQueries: [
      { type: 'stadium' },
      { keyword: 'piste athlétisme' },
      { keyword: 'running track' },
      { type: 'park' },
    ],
    lobbyActivities: [
      'Sortie 8 km · allure 5:20',
      'Fractionné 10×400 m',
      'Footing récup 45 min',
      'Seuil 6 km',
    ],
    spotLabel: 'Pistes & parcours',
  },
  {
    id: 'football',
    label: 'Football / Sports co',
    shortLabel: 'Sports co',
    family: 'team',
    primarySportId: 'football',
    accent: '#FF9F0A',
    placeQueries: [
      { type: 'stadium' },
      { keyword: 'terrain de football' },
      { keyword: 'synthetic football' },
      { keyword: 'gymnase' },
    ],
    lobbyActivities: [
      'Match amical 5v5',
      'Tech + finition',
      'Footing + ballon',
      'Séance collective',
    ],
    spotLabel: 'Terrains & gymnases',
  },
  {
    id: 'combat',
    label: 'Arts Martiaux / Combat',
    shortLabel: 'Combat',
    family: 'combat',
    primarySportId: 'boxe',
    accent: '#BF5AF2',
    placeQueries: [
      { keyword: 'boxe' },
      { keyword: 'mma' },
      { keyword: 'dojo' },
      { keyword: 'arts martiaux' },
      { type: 'gym' },
    ],
    lobbyActivities: [
      'Sparring technique',
      'Pad work 6 rounds',
      'Grappling / sol',
      'Cardio combat',
    ],
    spotLabel: 'Clubs & dojos',
  },
  {
    id: 'cyclisme',
    label: 'Cyclisme',
    shortLabel: 'Vélo',
    family: 'endurance',
    primarySportId: 'velo',
    accent: '#00B4FF',
    placeQueries: [
      { type: 'park' },
      { keyword: 'piste cyclable' },
      { keyword: 'velodrome' },
      { keyword: 'cyclisme' },
    ],
    lobbyActivities: [
      'Sortie 40 km endurance',
      'Intervalles côte',
      'Home trainer FTP',
      'Groupe rouleur',
    ],
    spotLabel: 'Pistes & parcours vélo',
  },
  {
    id: 'crossfit',
    label: 'CrossFit',
    shortLabel: 'CrossFit',
    family: 'hybrid',
    primarySportId: 'crossfit',
    accent: '#FF453A',
    placeQueries: [
      { keyword: 'crossfit' },
      { type: 'gym' },
      { keyword: 'box crossfit' },
    ],
    lobbyActivities: [
      'WOD Metcon 12 min',
      'Strength + WOD',
      'Hero WOD',
      'Skill pull-ups',
    ],
    spotLabel: 'Boxes CrossFit',
  },
  {
    id: 'fitness',
    label: 'Fitness général',
    shortLabel: 'Fitness',
    family: 'hybrid',
    primarySportId: 'cardio-salle',
    accent: '#64D2FF',
    placeQueries: [
      { type: 'gym' },
      { keyword: 'fitness' },
      { keyword: 'salle de sport' },
    ],
    lobbyActivities: [
      'Circuit full body',
      'Cardio + gainage',
      'Cours collectif',
      'Mobilité + force',
    ],
    spotLabel: 'Salles & clubs',
  },
]

const BY_ID = Object.fromEntries(APP_DISCIPLINES.map((d) => [d.id, d])) as Record<
  AppDisciplineId,
  AppDiscipline
>

const LABEL_TO_ID: Record<string, AppDisciplineId> = {
  Musculation: 'musculation',
  'Course à pied': 'course',
  Course: 'course',
  'Football / Sports co': 'football',
  Football: 'football',
  'Arts Martiaux / Combat': 'combat',
  Combat: 'combat',
  Cyclisme: 'cyclisme',
  CrossFit: 'crossfit',
  'Fitness général': 'fitness',
  Fitness: 'fitness',
}

const LOCAL_KEY = 'ranked-gym:discipline'

export function getDiscipline(id: AppDisciplineId): AppDiscipline {
  return BY_ID[id] ?? BY_ID.musculation
}

export function disciplineFromLabel(label: string | null | undefined): AppDisciplineId {
  if (!label) return getStoredDisciplineId()
  const direct = LABEL_TO_ID[label.trim()]
  if (direct) return direct
  const lower = label.toLowerCase()
  const hit = APP_DISCIPLINES.find(
    (d) =>
      d.label.toLowerCase() === lower ||
      d.shortLabel.toLowerCase() === lower ||
      d.id === lower,
  )
  return hit?.id ?? getStoredDisciplineId()
}

export function getStoredDisciplineId(): AppDisciplineId {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw && raw in BY_ID) return raw as AppDisciplineId
  } catch {
    /* ignore */
  }
  return 'musculation'
}

export function storeDisciplineId(id: AppDisciplineId): void {
  localStorage.setItem(LOCAL_KEY, id)
  window.dispatchEvent(new Event('ranked-gym:discipline-changed'))
}

export function isStrengthFamily(id: AppDisciplineId): boolean {
  const family = getDiscipline(id).family
  return family === 'strength' || family === 'hybrid'
}

export function isEnduranceFamily(id: AppDisciplineId): boolean {
  return getDiscipline(id).family === 'endurance'
}

/** Map sport catalog category → suggested discipline (best effort). */
export function disciplineFromSportCategory(
  category: SportCategory,
  sportId?: string,
): AppDisciplineId {
  if (sportId === 'crossfit') return 'crossfit'
  if (sportId === 'course-a-pied' || sportId === 'trail') return 'course'
  if (sportId === 'velo' || sportId === 'spinning') return 'cyclisme'
  if (category === 'strength') return 'musculation'
  if (category === 'combat') return 'combat'
  if (category === 'team') return 'football'
  if (category === 'cardio') return 'course'
  return 'fitness'
}
