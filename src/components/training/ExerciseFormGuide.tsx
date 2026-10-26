import { Play } from 'lucide-react'
import { formatCatalogMeta, type CatalogExercise } from '../../data/exerciseCatalog'
import { resolveFormVideoSrc } from '../../utils/exerciseFormMedia'
import { resolvePickerIllustrationSrc } from '../../utils/exercisePickerIllustrations'
import { IosSheet } from '../ui/IosSheet'

/**
 * Aide visuelle d’exécution : illustration 3D + vidéo parfaite quand elle existe.
 * Ouvrir depuis le picker ; ne remplace pas la sélection de l’exercice.
 */
export function ExerciseFormGuide({
  exercise,
  open,
  onClose,
}: {
  exercise: CatalogExercise | null
  open: boolean
  onClose: () => void
}) {
  const illustrationSrc = resolvePickerIllustrationSrc(exercise?.id)
  const videoSrc = resolveFormVideoSrc(exercise?.id)
  const meta = exercise ? formatCatalogMeta(exercise) : ''

  return (
    <IosSheet
      open={open && Boolean(exercise)}
      onClose={onClose}
      title={exercise?.name ?? 'Exécution'}
      subtitle={meta || 'Aide visuelle pour bien placer le mouvement'}
    >
      <div className="space-y-4 pb-2" data-exercise-form-guide>
        {videoSrc ? (
          <video
            key={videoSrc}
            src={videoSrc}
            poster={illustrationSrc ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="aspect-square w-full rounded-2xl bg-black object-contain"
            data-form-video
          />
        ) : illustrationSrc ? (
          <div className="overflow-hidden rounded-2xl bg-[#101214]">
            <img
              src={illustrationSrc}
              alt=""
              width={512}
              height={512}
              draggable={false}
              decoding="async"
              className="mx-auto aspect-square w-full max-w-sm object-contain"
              data-form-illustration
            />
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-[#1d1f20] text-[13px] text-[#ACB4BA]">
            Visuel bientôt disponible
          </div>
        )}

        {!videoSrc ? (
          <p
            className="text-[13px] leading-relaxed text-[#ACB4BA]"
            data-form-video-pending
          >
            La vidéo d’exécution parfaite arrive ensuite. En attendant, utilise
            l’illustration 3D pour placer le mouvement.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-[#ACB4BA]">
            Regarde une fois le mouvement complet, puis reproduis la même trajectoire.
          </p>
        )}
      </div>
    </IosSheet>
  )
}

/** Bouton discret « voir l’exécution » — n’ajoute pas l’exercice. */
export function ExerciseFormGuideTrigger({
  onOpen,
  label = 'Voir l’exécution',
}: {
  onOpen: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
      className="ios-press flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[#ACB4BA]"
      aria-label={label}
      data-form-guide-trigger
    >
      <Play className="h-4 w-4" strokeWidth={2.25} fill="currentColor" />
    </button>
  )
}
