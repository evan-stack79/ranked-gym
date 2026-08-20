import { useState } from 'react'
import { CheckCircle2, Plus, Zap } from 'lucide-react'
import type { SessionTemplate } from '../../types/training'
import { IosSheet } from '../ui/IosSheet'

const MUSCLE_PRESETS = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Abdos',
  'Quadriceps',
  'Ischios',
  'Fessiers',
  'Mollets',
]

interface SessionBoardProps {
  templates: SessionTemplate[]
  onStart: (template: SessionTemplate) => void
  onAddCustom: (title: string, muscles: string[]) => void
}

export function SessionBoard({ templates, onStart, onAddCustom }: SessionBoardProps) {
  const [customOpen, setCustomOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [muscles, setMuscles] = useState<string[]>([])

  const toggleMuscle = (m: string) => {
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Séances
          </p>
          <h2 className="text-[20px] font-bold text-white">Tes templates</h2>
        </div>
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="ios-press inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-[#AEAEB2]"
        >
          <Plus className="h-3.5 w-3.5" />
          Custom
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onStart(tpl)}
            className="ios-press relative overflow-hidden rounded-3xl border border-white/10 p-4 text-left"
            style={{
              background: `radial-gradient(ellipse 90% 80% at 0% 0%, ${tpl.accent}33 0%, transparent 60%), rgb(28 28 30 / 0.95)`,
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
            }}
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl"
              style={{ background: `${tpl.accent}22`, color: tpl.accent }}
            >
              <Zap className="h-4 w-4" />
            </div>
            <p className="text-[18px] font-black tracking-tight text-white">{tpl.title}</p>
            <p className="mt-0.5 text-[12px] text-[#8E8E93]">{tpl.subtitle}</p>
            <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#636366]">
              {tpl.muscles.join(' · ')}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: tpl.accent }} />
              Lancer
            </span>
          </button>
        ))}
      </div>

      <IosSheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Séance ciblée"
        subtitle="Ex. Lundi pectoraux — ultra simple"
      >
        <div className="space-y-4 pb-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Nom</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Pecs & triceps"
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#636366] outline-none"
            />
          </label>
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#8E8E93]">Muscles</p>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_PRESETS.map((m) => {
                const on = muscles.includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMuscle(m)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      on
                        ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-[#FF6961]'
                        : 'border-white/10 text-[#8E8E93]'
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onAddCustom(title || muscles.join(' + ') || 'Séance', muscles)
              setTitle('')
              setMuscles([])
              setCustomOpen(false)
            }}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
          >
            Ajouter la séance
          </button>
        </div>
      </IosSheet>
    </section>
  )
}
