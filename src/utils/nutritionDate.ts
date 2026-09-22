import { todayKey } from './calories'

export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function dateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey)
  date.setDate(date.getDate() + days)
  return dateKeyFromDate(date)
}

export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatNutritionDate(dateKey: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(dateFromKey(dateKey))
}

export function formatNutritionDateLong(dateKey: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(dateKey))
}

export function nutritionDateLabel(dateKey: string): string {
  const today = todayKey()
  if (dateKey === today) return `Aujourd’hui, ${formatNutritionDate(dateKey)}`
  if (dateKey === shiftDateKey(today, -1)) return `Hier, ${formatNutritionDate(dateKey)}`
  if (dateKey === shiftDateKey(today, 1)) return `Demain, ${formatNutritionDate(dateKey)}`
  return formatNutritionDateLong(dateKey)
}

export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Array.from({ length: offset + count }, (_, index) => {
    if (index < offset) return new Date(NaN)
    return new Date(month.getFullYear(), month.getMonth(), index - offset + 1)
  })
}