import { useEffect, useMemo, useState } from 'react'
import { startHmOptions } from '../../../horaires-variables/engine'
import { HV_RED } from '../../../horaires-variables/constants'
import { IosSheet } from '../../ui/IosSheet'

const CARD = '#1C1C1E'
const GRAY = '#ACB4BA'
const ROW = '#2C2C2E'

function fmtHm(hm: string): string {
  return hm.replace(/^0(\d:)/, '$1')
}

/**
 * Début du jour : heure par 15 min, ou « Repos » (pas de réveil).
 */
export function HvStartPickerSheet({
  open,
  onClose,
  title,
  mode,
  startHm,
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  mode: 'work' | 'repos'
  startHm: string | null
  onSave: (next: { kind: 'work' | 'repos'; startHm: string | null }) => void
}) {
  const options = useMemo(() => startHmOptions(15), [])
  const [tab, setTab] = useState<'heure' | 'repos'>(mode === 'repos' ? 'repos' : 'heure')
  const current = startHm ?? '08:00'

  useEffect(() => {
    if (open) setTab(mode === 'repos' ? 'repos' : 'heure')
  }, [open, mode])

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
      <div className="mb-3 flex rounded-xl p-1" style={{ backgroundColor: CARD }}>
        {(['heure', 'repos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="flex-1 rounded-lg py-2.5 text-[14px] font-semibold"
            style={{
              backgroundColor: tab === t ? ROW : 'transparent',
              color: tab === t ? '#fff' : GRAY,
            }}
            onClick={() => setTab(t)}
          >
            {t === 'heure' ? 'Je commence à' : 'Repos'}
          </button>
        ))}
      </div>

      {tab === 'repos' ? (
        <button
          type="button"
          className="ios-press min-h-[44px] w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
          style={{ backgroundColor: HV_RED }}
          onClick={() => {
            onSave({ kind: 'repos', startHm: null })
            onClose()
          }}
          data-hv-start-repos
        >
          Jour de repos · pas de réveil
        </button>
      ) : (
        <div
          className="max-h-[50vh] overflow-y-auto rounded-2xl"
          style={{ backgroundColor: CARD }}
          data-hv-start-picker
        >
          {options.map((hm) => {
            const selected = hm === current && mode === 'work'
            return (
              <button
                key={hm}
                type="button"
                onClick={() => {
                  onSave({ kind: 'work', startHm: hm })
                  onClose()
                }}
                className="ios-press flex min-h-[44px] w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left last:border-b-0"
                data-hv-start-option={hm}
              >
                <span className="text-[17px] tabular-nums text-white">{fmtHm(hm)}</span>
                {selected ? (
                  <span className="text-[18px] font-semibold" style={{ color: HV_RED }} aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </IosSheet>
  )
}
