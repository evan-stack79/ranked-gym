import { durationOptionsMin, formatDurationFr } from '../../../horaires-variables/engine'
import { HV_RED } from '../../../horaires-variables/constants'
import { IosSheet } from '../../ui/IosSheet'

const CARD = '#1C1C1E'
const GRAY = '#ACB4BA'

/**
 * Choix de durée 0–2 h par pas de 15 min (liste bas d'écran).
 */
export function HvDurationPickerSheet({
  open,
  onClose,
  title,
  valueMin,
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  valueMin: number
  onSave: (min: number) => void
}) {
  const options = durationOptionsMin()
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={title}
      leading={
        <button type="button" onClick={onClose} className="ios-press text-[17px]" style={{ color: HV_RED }}>
          Annuler
        </button>
      }
    >
      <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }} data-hv-duration-picker>
        {options.map((m, i) => {
          const selected = m === valueMin
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                onSave(m)
                onClose()
              }}
              className="ios-press flex min-h-[44px] w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left last:border-b-0"
              style={{ borderBottomWidth: i === options.length - 1 ? 0 : 1 }}
              data-hv-duration-option={m}
            >
              <span className="text-[17px] text-white">{formatDurationFr(m)}</span>
              {selected ? (
                <span className="text-[18px] font-semibold" style={{ color: HV_RED }} aria-hidden>
                  ✓
                </span>
              ) : (
                <span className="text-[13px]" style={{ color: GRAY }} />
              )}
            </button>
          )
        })}
      </div>
    </IosSheet>
  )
}
