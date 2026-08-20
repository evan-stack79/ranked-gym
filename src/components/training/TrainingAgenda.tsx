import { useMemo, useState } from 'react'
import { Bell, CalendarDays, Plus, Trash2 } from 'lucide-react'
import type { ScheduledSession, Weekday } from '../../types/training'
import { IosSheet } from '../ui/IosSheet'
import {
  notificationPermission,
  requestReminderPermission,
  sendTestNotification,
} from '../../services/reminderService'

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
  notificationsEnabled: boolean
  onSave: (entry: Omit<ScheduledSession, 'id'> & { id?: string }) => void
  onRemove: (id: string) => void
  onNotificationsChange: (enabled: boolean) => void
  onToast: (message: string) => void
}

export function TrainingAgenda({
  schedule,
  notificationsEnabled,
  onSave,
  onRemove,
  onNotificationsChange,
  onToast,
}: TrainingAgendaProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('Séance')
  const [days, setDays] = useState<Weekday[]>([1, 4])
  const [time, setTime] = useState('18:30')
  const [remindBefore, setRemindBefore] = useState(10)

  const sorted = useMemo(
    () =>
      [...schedule].sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title)),
    [schedule],
  )

  const perm = notificationPermission()

  const toggleDay = (d: Weekday) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  const enableNotifs = async () => {
    const ok = await requestReminderPermission()
    onNotificationsChange(ok)
    if (ok) {
      await sendTestNotification()
      onToast('Notifications activées — test envoyé')
    } else {
      onToast('Autorise les notifs dans Réglages Safari / Chrome')
    }
  }

  const handleAdd = async () => {
    if (days.length === 0 || !title.trim()) return
    if (!notificationsEnabled || perm !== 'granted') {
      await enableNotifs()
    }
    onSave({
      templateId: 'notebook',
      title: title.trim(),
      days,
      time,
      enabled: true,
      remindBeforeMin: remindBefore,
    })
    setOpen(false)
    onToast(`Rappel « ${title.trim()} » · ${time} (−${remindBefore} min)`)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Agenda
          </p>
          <h2 className="text-[20px] font-bold text-white">Rappels séance</h2>
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

      <button
        type="button"
        onClick={() => {
          void enableNotifs()
        }}
        className={`ios-press flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${
          notificationsEnabled && perm === 'granted'
            ? 'border-[#30D158]/35 bg-[#30D158]/10'
            : 'border-white/10 bg-black/25'
        }`}
      >
        <Bell
          className={`h-4 w-4 ${
            notificationsEnabled && perm === 'granted' ? 'text-[#30D158]' : 'text-[#8E8E93]'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">
            {perm === 'granted' ? 'Notifications ON' : 'Activer les notifications'}
          </p>
          <p className="text-[11px] text-[#8E8E93]">
            {perm === 'denied'
              ? 'Bloquées par le navigateur — active-les dans les réglages du site.'
              : 'Obligatoire pour être prévenu avant ta séance (garde l’app / PWA ouverte ou en fond).'}
          </p>
        </div>
      </button>

      {sorted.length === 0 ? (
        <div className="glass-card rounded-3xl px-5 py-8 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-[#8E8E93]" />
          <p className="mt-2 text-[14px] font-semibold text-white">Aucun créneau</p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">
            Ex. Muscu Lun/Jeu 18:30 — rappel 10 min avant.
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
                  {item.title} <span className="text-[#8E8E93]">· {item.time}</span>
                </p>
                <p className="text-[12px] text-[#8E8E93]">
                  {item.days.map((d) => DAY_NAMES[d]).join(' · ')}
                  {' · '}-
                  {item.remindBeforeMin ?? 10} min
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
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
              Nom de la séance
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Upper, Pecs, Course…"
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none"
            />
          </label>

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

          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#8E8E93]">Me prévenir</p>
            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRemindBefore(m)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                    remindBefore === m
                      ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-[#FF6961]'
                      : 'border-white/10 text-[#8E8E93]'
                  }`}
                >
                  {m} min avant
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleAdd()
            }}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
          >
            Enregistrer + activer rappel
          </button>
        </div>
      </IosSheet>
    </section>
  )
}
