import { Dumbbell, Footprints, MoreHorizontal, Users } from 'lucide-react'
import { TrainSheet as IosSheet } from './TrainSheet'
import type { AppDisciplineId } from '../../data/disciplines'

export type QuickActivityId = 'musculation' | 'course' | 'football' | 'autre'

const QUICK_ACTIVITIES: {
  id: QuickActivityId
  disciplineId: AppDisciplineId | null
  label: string
  hint: string
  icon: typeof Dumbbell
}[] = [
  {
    id: 'musculation',
    disciplineId: 'musculation',
    label: 'Musculation',
    hint: 'Routines & carnet',
    icon: Dumbbell,
  },
  {
    id: 'course',
    disciplineId: 'course',
    label: 'Course',
    hint: 'Distance & durée',
    icon: Footprints,
  },
  {
    id: 'football',
    disciplineId: 'football',
    label: 'Football',
    hint: 'Entraînement ou match',
    icon: Users,
  },
  {
    id: 'autre',
    disciplineId: null,
    label: 'Autre activité',
    hint: 'Catalogue complet',
    icon: MoreHorizontal,
  },
]

interface TrainActivitySheetProps {
  open: boolean
  onClose: () => void
  onSelect: (id: QuickActivityId) => void
}

/**
 * Bottom sheet sobre — Musculation / Course / Football / Autre activité.
 */
export function TrainActivitySheet({ open, onClose, onSelect }: TrainActivitySheetProps) {
  return (
    <IosSheet open={open} onClose={onClose} title="Nouvelle séance">
      <ul className="space-y-2 pb-2" data-new-session-sheet>
        {QUICK_ACTIVITIES.map((activity) => {
          const Icon = activity.icon
          return (
            <li key={activity.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(activity.id)
                  onClose()
                }}
                className="ios-press flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#141416] px-3.5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1c1c1e] text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-white">{activity.label}</span>
                  <span className="block text-[12px] text-[#8E8E93]">{activity.hint}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </IosSheet>
  )
}
