import {
  ACCUEIL_WIDGET_LABELS,
  resetAccueilWidgetPrefs,
  resolveHiddenAccueilWidgets,
  saveAccueilWidgetPrefs,
  showAccueilWidget,
  type AccueilWidgetId,
  type AccueilWidgetPrefs,
} from '../../utils/accueilWidgetPrefs'
import { IosSheet } from '../ui/IosSheet'

interface AccueilAddSheetProps {
  open: boolean
  prefs: AccueilWidgetPrefs
  onClose: () => void
  onSave: (prefs: AccueilWidgetPrefs) => void
}

/**
 * « + Ajouter » — re-add hidden Accueil tiles + reset to default.
 * Shown only while in-place edit mode is active.
 */
export function AccueilAddSheet({ open, prefs, onClose, onSave }: AccueilAddSheetProps) {
  const hidden = resolveHiddenAccueilWidgets(prefs)

  const commit = (next: AccueilWidgetPrefs) => {
    onSave(saveAccueilWidgetPrefs(next))
  }

  const handleAdd = (id: AccueilWidgetId) => {
    commit(showAccueilWidget(prefs, id, Date.now()))
  }

  const handleReset = () => {
    commit(resetAccueilWidgetPrefs(Date.now()))
    onClose()
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Ajouter"
      subtitle="Remets un bloc masqué sur l’Accueil"
      footer={
        <button
          type="button"
          onClick={handleReset}
          className="ios-press min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] font-medium text-[#AEAEB2]"
          data-accueil-edit-reset
        >
          Revenir à l&apos;accueil de départ
        </button>
      }
    >
      {hidden.length === 0 ? (
        <p className="px-1 py-4 text-[14px] text-[#8E8E93]" data-accueil-add-empty>
          Tous les blocs sont déjà affichés.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pb-2" data-accueil-add-list>
          {hidden.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => handleAdd(id)}
                className="ios-press flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
                data-accueil-add-item={id}
              >
                <span className="text-[15px] font-semibold text-white">
                  {ACCUEIL_WIDGET_LABELS[id]}
                </span>
                <span className="text-[13px] font-semibold text-[#0A84FF]">Ajouter</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </IosSheet>
  )
}
