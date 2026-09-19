# Validation wave 1 — illustrations d’exercices

**Branche :** `bot/exercise-assets-wave1`  
**Base :** `origin/bot/migrate-supabase-to-convex` @ `e176f42a08be90a4678a7a1f0715cc2f2c474738`  
**Statut :** assets + manifeste + planches uniquement. **Pas d’intégration UI. Pas de PR. En attente GO Evan.**

## Style

Référence officielle : illustration 3D monochrome du développé couché (athlète graphite, matériel noir/gris, éclairage studio doux, silhouette lisible).

Match de série :

- même mannequin masculin chauve, peau graphite mate, short noir, baskets noires ;
- matériel noir / gris, aucun rouge détecté (`has_saturated_red = false` sur les 12) ;
- fond réellement transparent (Pillow `RGBA`, ImageMagick `channels=srgba`, `alpha=True`) ;
- pas de texte, logo, sol, décor de salle, ombre rectangulaire, watermark.

Écarts de style (non bloquants, à trancher par Evan) :

- les mouvements debout sont plutôt en trois-quarts face (lisibilité icône) alors que la ref bench est plus de profil ;
- le visage est un peu plus indiqué que la ref (nez / orbites), toujours simplifié, pas de détails réalistes.

## Technique (chaque fichier)

| Fichier | Canonique | Size | Mode | Alpha | Poids |
|---|---|---|---|---|---|
| `incline-bench-press.png` | `incline_bench_press` | 1024×1024 | RGBA / srgba | oui (minA=0) | 240.9 Ko |
| `dumbbell-bench-press.png` | `dumbbell_bench_press` | 1024×1024 | RGBA / srgba | oui | 205.2 Ko |
| `overhead-press.png` | `overhead_press` | 1024×1024 | RGBA / srgba | oui | 163.3 Ko |
| `back-squat.png` | `back_squat` | 1024×1024 | RGBA / srgba | oui | 277.1 Ko |
| `deadlift.png` | `deadlift` | 1024×1024 | RGBA / srgba | oui | 244.0 Ko |
| `leg-press.png` | `leg_press` | 1024×1024 | RGBA / srgba | oui | 460.8 Ko |
| `barbell-row.png` | `barbell_row` | 1024×1024 | RGBA / srgba | oui | 223.0 Ko |
| `pull-up.png` | `pull_up` | 1024×1024 | RGBA / srgba | oui | 118.4 Ko |
| `lat-pulldown.png` | `lat_pulldown` | 1024×1024 | RGBA / srgba | oui | 200.0 Ko |
| `dumbbell-curl.png` | `dumbbell_curl` | 1024×1024 | RGBA / srgba | oui | 142.2 Ko |
| `lateral-raise.png` | `lateral_raise` | 1024×1024 | RGBA / srgba | oui | 138.3 Ko |
| `triceps-pushdown.png` | `triceps_pushdown` | 1024×1024 | RGBA / srgba | oui | 173.4 Ko |

Post-traitement : `rembg` + nettoyage du glow de sol + recadrage centré marges ~7 % + PNG optimisé. Aucune dégradation visible à 1024.

## Preuves visuelles

Dans ce dossier :

- `validation/planche-12-fond-noir.png`
- `validation/planche-12-fond-blanc.png`
- `validation/lisibilite-56px.png`
- `validation/lisibilite-72px.png`
- `validation/file-stats.json`

Copies agent : `/opt/cursor/artifacts/exercise-wave1-proofs/` (planches + chaque illu sur noir/blanc + 56/72 px).

Lisibilité 56 px : squat, presse, développé, curl, élévations et rowing restent identifiables. Traction et pushdown sont plus fins (tour + corde) mais encore lisibles. 72 px : tous lisibles.

## Doutes anatomiques (à trancher, pas d’intégration)

| Id | Verdict | Doute |
|---|---|---|
| `incline_bench_press` | OK | Banc incliné clair, barre droite, 1 plaque / côté. |
| `dumbbell_bench_press` | OK avec réserve | Haltères identiques. Épaule côté tête un peu aplatie par l’angle. |
| `overhead_press` | OK | Lockout debout, bar path vertical, plaques symétriques. |
| `back_squat` | OK | Barre haut du dos, parallèle, genoux alignés. |
| `deadlift` | Réserve | Départ genoux fléchis / torse haut : correct. **Barre un peu haute** (genou plutôt que mid-tibia). |
| `leg_press` | OK avec réserve | Vraie presse 45°. Jambes plus tendues qu’un 90° profond. |
| `barbell_row` | Réserve | Buste ~45°, dos neutre. **Barre à la hanche / haut de cuisse**, pas collée aux côtes. |
| `pull_up` | OK avec réserve | Bien **suspendu** (genoux pliés). Milieu de course, pas menton-barre. |
| `lat_pulldown` | OK | Assis, poulie haute, barre large. Pads un peu hauts sur les cuisses. |
| `dumbbell_curl` | OK | Flexion coude, haltères identiques. |
| `triceps_pushdown` | Réserve | Poulie + corde OK. **Lockout mou** : plutôt « tient la corde » qu’extension dure. |
| `lateral_raise` | OK | Debout, bras en T, haltères identiques. |

Aucune image rejetée pour membres manquants, barre tordue, haltères non jumeaux, ou matériel fusionné au corps.

## Fichiers créés (repo)

```
assets/exercises/illustrations/wave1/incline-bench-press.png
assets/exercises/illustrations/wave1/dumbbell-bench-press.png
assets/exercises/illustrations/wave1/overhead-press.png
assets/exercises/illustrations/wave1/back-squat.png
assets/exercises/illustrations/wave1/deadlift.png
assets/exercises/illustrations/wave1/leg-press.png
assets/exercises/illustrations/wave1/barbell-row.png
assets/exercises/illustrations/wave1/pull-up.png
assets/exercises/illustrations/wave1/lat-pulldown.png
assets/exercises/illustrations/wave1/dumbbell-curl.png
assets/exercises/illustrations/wave1/triceps-pushdown.png
assets/exercises/illustrations/wave1/lateral-raise.png
assets/exercises/illustrations/wave1/manifest.json
assets/exercises/illustrations/wave1/README.md
assets/exercises/illustrations/wave1/VALIDATION.md
assets/exercises/illustrations/wave1/validation/planche-12-fond-noir.png
assets/exercises/illustrations/wave1/validation/planche-12-fond-blanc.png
assets/exercises/illustrations/wave1/validation/lisibilite-56px.png
assets/exercises/illustrations/wave1/validation/lisibilite-72px.png
assets/exercises/illustrations/wave1/validation/file-stats.json
```

## Non-changé (volontaire)

- `src/assets/exercises/developpe-couche.webp` / `.jpg`
- `src/utils/exerciseMedia.ts` (`CANONICAL_ASSETS` = `bench_press` seulement)
- sélecteur d’exercices, flags Convex, Cloudflare, `main`

## STOP

Commit + push de `bot/exercise-assets-wave1` uniquement. **Pas de PR, pas d’intégration.** Attendre GO Evan.
