import { useMemo, useState } from 'react'
import { Bell, CalendarDays, Plus, Trash2 } from 'lucide-react'
import type { ScheduledSession, SessionTemplate, Weekday } from '../../types/training'
import { IosSheet } from '../ui/IosSheet'

const DAY_LABELS: { day: Weekday; short: string }[] = [
  { day: 1, short: 'L' },
  { day: 2, short: 'M' },
  { day: 3, short: 'M' },
  { day: 4, short: 'J' },
  { day: 5, short: 'V' },
  { day: 6, short: 'S' },
  { day: 0, short: 'D' },
]

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface TrainingAgendaProps {
  schedule: ScheduledSession[]
  templates: SessionTemplate[]
  onSave: (entry: Omit<ScheduledSession, 'id'> & { id?: string }) => void
  onRemove: (id: string) => void
}

export function TrainingAgenda({ schedule, templates, onSave, onRemove }: TrainingAgendaProps) {
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [days, setDays] = useState<Weekday[]>([1, 4])
  const [time, setTime] = useState('18:30')

  const sorted = useMemo(
    () =>
      [...schedule].sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title)),
    [schedule],
  )

  const toggleDay = (d: Weekday) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  const handleAdd = () => {
    const tpl = templates.find((t) => t.id === templateId) ?? templates[0]
    if (!tpl || days.length === 0) return
    onSave({
      templateId: tpl.id,
      title: tpl.title,
      days,
      time,
      enabled: true,
    })
    setOpen(false)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Agenda
          </p>
          <h2 className="text-[20px] font-bold text-white">Rappels simples</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ios-press inline-flex items-center gap-1 rounded-full border border-[#FF2B2B]/35 bg-[#FF2B2B]/15 px-3 py-1.5 text-[12px] font-semibold text-[#FF6961]"
        >
          <Plus className="h-3.5 w-3.5" />
          Créneau
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="glass-card rounded-3xl px-5 py-8 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-[#8E8E93]" />
          <p className="mt-2 text-[14px] font-semibold text-white">Aucun créneau</p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">
            Ex. Upper Lun/Jeu 18:30 — 10 secondes à régler.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="glass-card flex items-center gap-3 rounded-2xl px-3.5 py-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF2B2B]/15 text-[#FF6961]">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {item.title}{' '}
                  <span className="text-[#8E8E93]">· {item.time}</span>
                </p>
                <p className="text-[12px] text-[#8E8E93]">
                  {item.days.map((d) => DAY_NAMES[d]).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-[#8E8E93]"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <IosSheet open={open} onClose={() => setOpen(false)} title="Nouveau créneau" subtitle="Rapide">
        <div className="space-y-4 pb-2">
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#8E8E93]">Séance</p>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                    templateId === tpl.id
                      ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-[#FF6961]'
                      : 'border-white/10 text-[#8E8E93]'
                  }`}
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#8E8E93]">Jours</p>
            <div className="flex gap-1.5">
              {DAY_LABELS.map(({ day, short }) => {
                const on = days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold ${
                      on ? 'bg-[#FF2B2B] text-white' : 'bg-white/5 text-[#8E8E93]'
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Heure</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[16px] text-white outline-none"
            />
          </label>

          <button
            type="button"
            onClick={handleAdd}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
          >
            Enregistrer le rappel
          </button>
        </div>
      </IosSheet>
    </section>
  )
}
