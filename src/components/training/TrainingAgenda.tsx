import { useMemo, useState } from 'react'
import { Bell, CalendarDays, Plus, Trash2 } from 'lucide-react'
import type { ScheduledSession, Weekday, WorkoutRoutine } from '../../types/training'
import { getSportById, SPORTS } from '../../data/sports'
import { sessionKindForSport } from '../../utils/sessionMeta'
import { TrainSheet as IosSheet } from './TrainSheet'
import {
  notificationPermission,
  requestReminderPermission,
  sendTestNotification,
} from '../../services/reminderService'

const DAY_LABELS: { day: Weekday; short: string; name: string }[] = [
  { day: 1, short: 'L', name: 'Lundi' },
  { day: 2, short: 'M', name: 'Mardi' },
  { day: 3, short: 'M', name: 'Mercredi' },
  { day: 4, short: 'J', name: 'Jeudi' },
  { day: 5, short: 'V', name: 'Vendredi' },
  { day: 6, short: 'S', name: 'Samedi' },
  { day: 0, short: 'D', name: 'Dimanche' },
]

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface TrainingAgendaProps {
  schedule: ScheduledSession[]
  routines: WorkoutRoutine[]
  primarySportId: string
  notificationsEnabled: boolean
  onSave: (entry: Omit<ScheduledSession, 'id'> & { id?: string }) => void
  onRemove: (id: string) => void
  onNotificationsChange: (enabled: boolean) => void
  onToast: (message: string) => void
}

export function TrainingAgenda({
  schedule,
  routines,
  primarySportId,
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
  const [sportId, setSportId] = useState(() =>
    getSportById(primarySportId) ? primarySportId : 'musculation',
  )
  const [routineId, setRoutineId] = useState(
    () => routines.find((routine) => routine.exercises.length > 0)?.id ?? 'notebook',
  )

  const sessionKind = sessionKindForSport(sportId)

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
      templateId: sessionKind === 'strength' ? routineId : 'notebook',
      title: title.trim(),
      days,
      time,
      enabled: true,
      remindBeforeMin: remindBefore,
      sportId,
      sessionKind,
    })
    setOpen(false)
    onToast(`Rappel « ${title.trim()} » · ${time} (−${remindBefore} min)`)
  }

  return (
    <section className="space-y-3" data-agenda-root>
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ACB4BA]">
            Agenda
          </p>
          <h2 className="text-[20px] font-bold text-white">Rappels séance</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-agenda-control="create"
          className="ios-press inline-flex min-h-11 items-center gap-1 rounded-full border border-[#FF0702]/35 bg-[#FF0702]/15 px-3 py-2 text-[12px] font-semibold text-[#FF907F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000]"
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
        data-agenda-control="notifications"
        className={`ios-press flex min-h-11 w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000] ${
          notificationsEnabled && perm === 'granted'
            ? 'border-[#30D158]/35 bg-[#30D158]/10'
            : 'border-white/10 bg-black/25'
        }`}
      >
        <Bell
          className={`h-4 w-4 ${
            notificationsEnabled && perm === 'granted' ? 'text-[#30D158]' : 'text-[#ACB4BA]'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">
            {perm === 'granted' ? 'Notifications ON' : 'Activer les notifications'}
          </p>
          <p className="text-[11px] text-[#ACB4BA]">
            {perm === 'denied'
              ? 'Bloquées par le navigateur — active-les dans les réglages du site.'
              : 'Obligatoire pour être prévenu avant ta séance (garde l’app / PWA ouverte ou en fond).'}
          </p>
        </div>
      </button>

      {sorted.length === 0 ? (
        <div className="glass-card rounded-3xl px-5 py-8 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-[#ACB4BA]" />
          <p className="mt-2 text-[14px] font-semibold text-white">Aucun créneau</p>
          <p className="mt-1 text-[12px] text-[#ACB4BA]">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF0702]/15 text-[#FF907F]">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {item.title} <span className="text-[#ACB4BA]">· {item.time}</span>
                </p>
                <p className="text-[12px] text-[#ACB4BA]">
                  {item.days.map((d) => DAY_NAMES[d]).join(' · ')}
                  {' · '}-
                  {item.remindBeforeMin ?? 10} min
                </p>
                <p className="text-[11px] text-[#717C83]">
                  {item.sportId
                    ? getSportById(item.sportId)?.name ?? item.title
                    : 'Sport non précisé · ancien créneau'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                data-agenda-control="delete"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#ACB4BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000]"
                aria-label={`Supprimer ${item.title}`}
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
            <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
              Nom de la séance
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Upper, Pecs, Course…"
              data-agenda-control="title"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
              Sport
            </span>
            <select
              value={sportId}
              onChange={(event) => {
                const nextSportId = event.target.value
                setSportId(nextSportId)
                if (sessionKindForSport(nextSportId) === 'strength') {
                  setRoutineId((current) =>
                    routines.some((routine) => routine.id === current && routine.exercises.length > 0)
                      ? current
                      : routines.find((routine) => routine.exercises.length > 0)?.id ?? 'notebook',
                  )
                }
              }}
              data-agenda-control="sport"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-[#141416] px-3.5 py-3 text-[15px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70"
            >
              {[...SPORTS]
                .sort((a, b) => b.popularity - a.popularity)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>

          {sessionKind === 'strength' ? (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
                Routine
              </span>
              <select
                value={routineId}
                onChange={(event) => setRoutineId(event.target.value)}
                data-agenda-control="routine"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#141416] px-3.5 py-3 text-[15px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70"
              >
                <option value="notebook">Choisir dans le carnet</option>
                {routines.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.label}{routine.exercises.length === 0 ? ' · vide' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#ACB4BA]">Jours</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map(({ day, short, name }) => {
                const on = days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    data-agenda-control="day"
                    aria-label={name}
                    aria-pressed={on}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1D1F20] ${
                      on ? 'bg-[#FF0702] text-white' : 'bg-white/5 text-[#ACB4BA]'
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">Heure</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              data-agenda-control="time"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[16px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70"
            />
          </label>

          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#ACB4BA]">Me prévenir</p>
            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRemindBefore(m)}
                  data-agenda-control="reminder"
                  aria-pressed={remindBefore === m}
                  className={`min-h-11 rounded-full border px-3 py-2 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1D1F20] ${
                    remindBefore === m
                      ? 'border-[#FF0702]/45 bg-[#FF0702]/20 text-[#FF907F]'
                      : 'border-white/10 text-[#ACB4BA]'
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
            data-agenda-control="save"
            className="btn-brand ios-press min-h-11 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1D1F20]"
          >
            Enregistrer + activer rappel
          </button>
        </div>
      </IosSheet>
    </section>
  )
}
