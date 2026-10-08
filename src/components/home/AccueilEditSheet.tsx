import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  ACCUEIL_WIDGET_IDS,
  ACCUEIL_WIDGET_LABELS,
  isAccueilWidgetVisible,
  moveAccueilWidget,
  normalizeAccueilWidgetPrefs,
  normalizeWaterGoalMl,
  resetAccueilWidgetPrefs,
  saveAccueilWidgetPrefs,
  setAccueilWaterGoalMl,
  toggleAccueilWidgetHidden,
  type AccueilWidgetId,
  type AccueilWidgetPrefs,
} from '../../utils/accueilWidgetPrefs'
import { IosSheet } from '../ui/IosSheet'

interface AccueilEditSheetProps {
  open: boolean
  prefs: AccueilWidgetPrefs
  onClose: () => void
  onSave: (prefs: AccueilWidgetPrefs) => void
}

/**
 * Edit Accueil blocks — show/hide + move up/down + optional water goal.
 * No motion inside the form (audit + reduced-motion friendly).
 */
export function AccueilEditSheet({ open, prefs, onClose, onSave }: AccueilEditSheetProps) {
  const [draft, setDraft] = useState<AccueilWidgetPrefs>(() => normalizeAccueilWidgetPrefs(prefs))
  const [waterDraft, setWaterDraft] = useState('')

  useEffect(() => {
    if (!open) return
    const next = normalizeAccueilWidgetPrefs(prefs)
    setDraft(next)
    const goal = normalizeWaterGoalMl(next.waterGoalMl)
    setWaterDraft(goal != null ? String(goal) : '')
  }, [open, prefs])

  const order = draft.order.filter((id): id is AccueilWidgetId =>
    (ACCUEIL_WIDGET_IDS as readonly string[]).includes(id),
  )

  const commit = (next: AccueilWidgetPrefs) => {
    const saved = saveAccueilWidgetPrefs(next)
    onSave(saved)
  }

  const handleDone = () => {
    const withGoal = setAccueilWaterGoalMl(
      draft,
      waterDraft.trim() === '' ? null : Number(waterDraft.replace(',', '.')),
      Date.now(),
    )
    commit(withGoal)
    onClose()
  }

  const handleReset = () => {
    const next = resetAccueilWidgetPrefs(Date.now())
    setDraft(next)
    setWaterDraft('')
    commit(next)
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Modifier l'accueil"
      subtitle="Affiche, cache ou déplace les blocs"
      footer={
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleDone}
            className="btn-brand ios-press min-h-11 w-full rounded-2xl border border-white/15 px-4 py-2.5 text-[15px] font-semibold text-white"
            data-accueil-edit-done
          >
            Terminé
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="ios-press min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] font-medium text-[#AEAEB2]"
            data-accueil-edit-reset
          >
            Revenir à l&apos;accueil de départ
          </button>
        </div>
      }
    >
      <ul className="flex flex-col gap-2 pb-2" data-accueil-edit-list>
        {order.map((id, index) => {
          const visible = isAccueilWidgetVisible(draft, id)
          const label = ACCUEIL_WIDGET_LABELS[id]
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
              data-accueil-edit-row={id}
            >
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setDraft(moveAccueilWidget(draft, id, 'up'))}
                  className="ios-press flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-30"
                  aria-label={`Monter ${label}`}
                  data-accueil-edit-up={id}
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  onClick={() => setDraft(moveAccueilWidget(draft, id, 'down'))}
                  className="ios-press flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-30"
                  aria-label={`Descendre ${label}`}
                  data-accueil-edit-down={id}
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-[12px] text-[#8E8E93]">
                  {visible ? 'Affiché' : 'Masqué'}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={visible ? `Masquer ${label}` : `Afficher ${label}`}
                onClick={() => setDraft(toggleAccueilWidgetHidden(draft, id))}
                className={`relative h-8 w-[52px] shrink-0 overflow-hidden rounded-full ${
                  visible ? 'bg-[#FF2B2B]' : 'bg-[#3A3A3C]'
                }`}
                data-accueil-edit-toggle={id}
              >
                <span
                  className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow ${
                    visible ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ul>

      <div
        className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
        data-accueil-edit-water-goal
      >
        <p className="text-[15px] font-semibold text-white">Objectif d&apos;eau (ml)</p>
        <p className="mt-0.5 text-[12px] text-[#8E8E93]">
          Optionnel — sans valeur, la tuile Eau n&apos;affiche pas d&apos;anneau.
        </p>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20000}
          step={50}
          value={waterDraft}
          onChange={(e) => setWaterDraft(e.target.value)}
          placeholder="Aucun"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[16px] font-semibold tabular-nums text-white outline-none focus:border-[#0A84FF]/50"
          data-accueil-edit-water-input
        />
      </div>

      <p className="px-1 pb-4 pt-3 text-[12px] leading-snug text-[#8E8E93]">
        Pas de calories, poids ou mesures du corps sur l&apos;Accueil.
      </p>
    </IosSheet>
  )
}
