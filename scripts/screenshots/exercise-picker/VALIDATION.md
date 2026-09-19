# Validation — sélecteur d’exercices

## Base
- Branch: `bot/ux-exercise-picker`
- Base tip: `e78ada4eaed9c88ff9708615293d1f42b0baebde` (`origin/bot/migrate-supabase-to-convex`, PR #40 hero immersif)
- Hero préservé: `src/assets/exercises/developpe-couche.webp` + `canonicalExerciseId` / `bench_press`
- **Pas de PR** (push branche seulement)

## Captures (390×844)
| Fichier | Contenu |
|---|---|
| `picker-before-query-390.png` | Avant saisie — titres exacts, liste top popularité, compteur |
| `picker-search-developpe-390.png` | Recherche « développé » — bibliothèque réelle |
| `picker-search-focused-390.png` | Champ focus / saisie en cours (« dévelop ») |
| `immersive-after-select-390.png` | Après tap Développé couché — immersif + hero local |
| `picker_select_to_immersive_demo.mp4` | Vidéo sélection → ouverture immersif (~72 Ko) |

## Libellés exacts (mode premier exo)
- « Quel est ton premier exercice ? »
- « Choisis un mouvement pour commencer. »
- « + Créer un exercice personnalisé »
- « Séance libre » : absent de cet écran

## Tests exécutés
- `npm test` — 451/451 OK
- `npm run lint` — OK (warnings préexistants hors picker)
- `npm run build` — OK (`developpe-couche-*.webp` dans `dist`)

## Écarts restants vs ref
- Soft keyboard OS non capturable en Chromium desktop (focus + texte saisi à la place)
- Miniature réelle uniquement pour `bench_press` ; autres = placeholder graphite neutre
- Recherche « développé » → 5 résultats catalogue (ref en montre 4) — bibliothèque réelle plus complète
