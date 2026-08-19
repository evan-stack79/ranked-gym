import type { RankInfo } from '../../utils/rank'
import { rankVisuals } from '../../utils/rankVisuals'

interface RankShowcaseProps {
  rank: RankInfo
  level: number
}

export function RankShowcase({ rank, level }: RankShowcaseProps) {
  const visual = rankVisuals[rank.tier]

  return (
    <section
      className={`overflow-hidden rounded-3xl bg-gradient-to-br ${visual.gradient} p-6`}
      aria-label={`Rang ${rank.label}`}
    >
      <p className={`text-[13px] font-medium ${visual.sublabel}`}>Muscu Classée</p>

      <h2 className={`mt-3 text-[34px] font-bold tracking-tight ${visual.label}`}>
        {rank.label}
      </h2>

      <p className={`mt-1 text-[15px] font-medium ${visual.sublabel}`}>{rank.tier}</p>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className={`text-[13px] ${visual.sublabel}`}>Niveau</p>
          <p className={`text-[22px] font-semibold tracking-tight ${visual.label}`}>{level}</p>
        </div>
        <p className={`text-right text-[13px] ${visual.sublabel}`}>
          Division {rank.division}
        </p>
      </div>
    </section>
  )
}
