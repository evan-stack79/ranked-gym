# Recommandations Training — algorithme

Moteur **déterministe** dans `src/training-engine/`. Aucune IA distante, aucun pourcentage inventé.

## Données utilisées (uniquement si réelles)

| Source | Champ | Si absent |
| --- | --- | --- |
| `TrainingState.favoriteSportIds` | Sports choisis | Pas de candidat (sauf « je ne sais pas encore ») |
| `CalorieProfile.goal` | Objectif cut / maintain / bulk | Pas de bonus objectif |
| `TrainingState.trainingLevel` | Niveau déclaré | Pas de bonus / filtre avancé |
| `TrainingState.availableEquipment` | Matériel déclaré | **Aucun filtre** (ne pas inventer d’inventaire) |
| `TrainingState.limitedExerciseIds` / `limitedMuscles` | Limitations | Aucune exclusion |
| `TrainingState.dismissedExerciseIds` | « Pas pour moi » | — |
| `workoutNotes` + `canonicalExerciseId` | Historique | Cold-start sports + objectif + niveau + matériel |
| Séance active | Doublons | Exclus |

**Jamais** : analyse seule du titre libre. Un nom comme « DÉVELOPPER » sans `canonicalExerciseId` (et hors mapping média fiable) est ignoré.

## Filtres durs (dans l’ordre)

1. Identifiant catalogue canonique
2. Refusé / limitation exercice
3. Muscle limité (intersection avec `muscles`)
4. Déjà dans la séance en cours
5. Matériel incompatible **si** un inventaire non vide est déclaré
6. Débutant : exercices `advanced` exclus
7. Sport : intersection `exercise.sportIds` ∩ sports choisis (sauf `sportsUndecided`)

Zéro candidat → **aucune carte**. Pas de fallback marketing.

## Score (entier, plus haut = mieux)

| Composante | Points | Plafond |
| --- | --- | --- |
| Fréquence (séance terminée contenant l’id) | +40 / complétion | 5 × 40 = 200 |
| Complétion ≤ 14 jours | +30 | 30 |
| Sport compatible | +25 | 25 |
| Complément de mouvement (push↔pull, haut↔jambes) | +20 | 20 |
| Objectif (`bulk`→hypertrophy, `cut`→endurance/hypertrophy, `maintain`→strength) | +12 | 12 |
| Niveau déclaré identique | +10 | 10 |
| Matériel déclaré identique | +8 | 8 |
| Popularité catalogue | `floor(popularity / 20)` | 5 |

**Tie-break** : score desc → popularité desc → `id` asc (`localeCompare`).

## Slots

- **À refaire** : `completionCount ≥ 2`, ou `≥ 1` récente si personne n’a 2.
- **À découvrir** : `completionCount === 0`, id différent du redo.
- Sans historique : une carte **À découvrir** (sports + objectif + niveau + matériel).

## Justification (priorité, 1 seule phrase)

1. Fréquence ≥ 80 → « Parce que tu réalises souvent ce mouvement »
2. Complément → « Pour compléter ton entraînement de poussée / tirage / jambes »
3. Objectif ou matériel → « Adapté à ton objectif et à ton matériel »
4. Sport → « Adapté aux sports que tu as choisis »
5. Niveau → « Adapté à ton niveau »

Durée affichée **uniquement** si calculable. Aujourd’hui : toujours `null` (pas de durée d’exercice isolée dans le catalogue).

Visuel : illustration locale par id (`exercisePickerIllustrations`), sinon pastille graphite. Jamais d’URL externe.

## Flag

`VITE_ENABLE_TRAINING_RECOMMENDATIONS` — défaut ON en DEV/test, OFF en production si unset.

## Écarts (non inventés au runtime)

- Catalogue exercices encore **orienté force** : un sport type tennis n’a pas d’exercice canonique → 0 carte.
- Pas de niveau Training historique : `trainingLevel` est additif, vide par défaut.
- Pas d’inventaire matériel historique : `availableEquipment` vide = pas de filtre.
- Pas de séances « abandonnées » distinctes : seul `workoutNotes` compte comme terminé.
