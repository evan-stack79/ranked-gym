import {
  BEGINNER_PROGRAMME_DETAIL,
  BEGINNER_PROGRAMME_SUBTITLE,
  BEGINNER_PROGRAMME_TITLE,
} from '../../data/beginnerProgramme'

export function TrainBeginnerProgrammeCard({ onStart }: { onStart: () => void }) {
  return (
    <section
      className="rounded-3xl border border-white/10 bg-[#141416] p-4"
      data-testid="train-beginner-programme"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8E8E93]">
        Programme
      </p>
      <h2 className="mt-1 text-[18px] font-bold text-white">{BEGINNER_PROGRAMME_TITLE}</h2>
      <p className="mt-1 text-[13px] text-[#AEAEB2]">{BEGINNER_PROGRAMME_SUBTITLE}</p>
      <p className="mt-2 text-[13px] text-[#8E8E93]">{BEGINNER_PROGRAMME_DETAIL}</p>
      <button
        type="button"
        onClick={onStart}
        className="btn-brand ios-press mt-4 flex min-h-11 w-full items-center justify-center rounded-2xl py-3 text-[15px] font-semibold text-white"
        data-testid="train-beginner-start"
      >
        Lancer le programme
      </button>
    </section>
  )
}
