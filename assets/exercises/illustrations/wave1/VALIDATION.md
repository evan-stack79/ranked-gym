# Validation wave 1 — audit + correction (ronde 2)

**Branche :** `bot/exercise-assets-wave1`  
**Parent :** `f068667c2ebcda1da9a927e79c11c9e839e801ff`  
**Statut :** assets + manifeste + planches uniquement. **Pas d’intégration UI. Pas de PR. En attente GO Evan.**

## Correction obligatoire

`dumbbell-bench-press.png` régénéré **entièrement** (essai 1 / 3, livré).

- **Avant :** 2 bras + haltères en press **et** un 3ᵉ bras pendant le long du banc (membre surnuméraire).
- **Après (PNG ouvert à 100 %) :** exactement **2 bras**, **2 mains**, **2 haltères** (une par main), **2 jambes**, **2 pieds**. Aucun membre fusionné / dupliqué / ambigu. Corps à plat sur banc plat. Mains autour des poignées. Mouvement immédiatement lisible (développé couché haltères).

Les 3 autres fichiers listés en contrôles prioritaires n’ont été remplacés que pour un défaut réel.

## Style

Référence officielle : illustration 3D monochrome du développé couché (graphite, matériel noir/gris, éclairage studio, silhouette lisible).

Série :

- mannequin masculin chauve, peau graphite mate, short noir, baskets noires ;
- matériel noir / gris, `has_saturated_red = false` sur les 12 ;
- fond réellement transparent (Pillow `RGBA`, ImageMagick `channels=srgba`, `opaque=false`, `IHDR.color_type=6`, `minA=0`) ;
- pas de texte, logo, sol, décor de salle, watermark.

## Tableau des 12 (audit 100 %)

Chaque PNG a été ouvert à 1024×1024 (pas seulement la planche). Comptage bras / mains / jambes / pieds, contacts, matériel, posture, style, alpha.

| Fichier | Id canonique | Statut | Justification |
|---|---|---|---|
| `incline-bench-press.png` | `incline_bench_press` | **VALIDÉ** | 2 bras, 2 mains sur la barre, 2 jambes, 2 pieds au sol. Banc incliné lisible, barre droite, 1 disque / côté. Inchangé. |
| `dumbbell-bench-press.png` | `dumbbell_bench_press` | **CORRIGÉ** | Bug 3 bras éliminé. 2 bras + 2 mains + 2 haltères hexagonales identiques au lockout. Banc plat, bassin/dos/tête posés, genoux fléchis, 2 pieds. Aucun 3ᵉ membre sur le flanc du banc (crop 100 % jambes). |
| `overhead-press.png` | `overhead_press` | **VALIDÉ** | 2 bras, 2 mains sur barre lockout, 2 jambes, 2 pieds. Barre droite, disques symétriques. Inchangé. |
| `back-squat.png` | `back_squat` | **VALIDÉ** | 2 bras, 2 mains, barre sur le haut du dos, 2 jambes, 2 pieds. Profondeur squat lisible, barre parallèle. Inchangé. |
| `deadlift.png` | `deadlift` | **CORRIGÉ** | Avant : barre trop haute (genou). Après : départ identifiable, **barre mid-tibia collée aux tibias**, 2 disques / côté dont la base est au niveau des semelles, 2 mains en pronation, 2 pieds. Posture encore un peu « squatty » (genoux très fléchis) mais plus de barre à hauteur de genou. |
| `leg-press.png` | `leg_press` | **VALIDÉ** | Presse 45° crédible. 2 jambes, 2 pieds à plat sur la plateforme diamant, 2 mains sur les poignées. Inchangé. |
| `barbell-row.png` | `barbell_row` | **CORRIGÉ** | Avant : barre à la hanche / haut de cuisse (ambigu RDL). Après : 2 mains, coudes fléchis en tirage, **barre au bas du torse** (abdomen / ceinture, au-dessus des hanches). Pas collée aux côtes basses ; le mouvement est un rowing, plus une RDL. |
| `pull-up.png` | `pull_up` | **CORRIGÉ** | Avant : barre cylindrique flottante sans ancrage. Après : cage 2 montants + semelles, barre boulonnée entre les montants, 2 mains en pronation, genoux fléchis, pieds décollés. Barre non flottante. |
| `lat-pulldown.png` | `lat_pulldown` | **VALIDÉ** | Assis, poulie haute. **2 mains clairement visibles**. Barre large **devant le visage, vers le haut de poitrine**. 2 jambes, 2 pieds. Inchangé. |
| `dumbbell-curl.png` | `dumbbell_curl` | **VALIDÉ** | 2 bras, 2 mains, 2 haltères identiques en flexion, 2 jambes, 2 pieds. Inchangé. |
| `triceps-pushdown.png` | `triceps_pushdown` | **VALIDÉ** | **2 mains distinctes** sur la corde, coudes près du corps, **2 extrémités de corde + boules visibles**. Poulie haute. Inchangé (lockout encore un peu souple, non bloquant). |
| `lateral-raise.png` | `lateral_raise` | **VALIDÉ** | 2 bras en T, 2 haltères identiques, 2 jambes, 2 pieds. Inchangé. |

Aucun fichier en **À REVOIR**.

## Technique (chaque fichier)

| Fichier | Canonique | Size | Mode | Alpha | Poids |
|---|---|---|---|---|---|
| `incline-bench-press.png` | `incline_bench_press` | 1024×1024 | RGBA / srgba | oui (minA=0) | 240.9 Ko |
| `dumbbell-bench-press.png` | `dumbbell_bench_press` | 1024×1024 | RGBA / srgba | oui | 247.6 Ko |
| `overhead-press.png` | `overhead_press` | 1024×1024 | RGBA / srgba | oui | 163.3 Ko |
| `back-squat.png` | `back_squat` | 1024×1024 | RGBA / srgba | oui | 277.1 Ko |
| `deadlift.png` | `deadlift` | 1024×1024 | RGBA / srgba | oui | 246.6 Ko |
| `leg-press.png` | `leg_press` | 1024×1024 | RGBA / srgba | oui | 460.8 Ko |
| `barbell-row.png` | `barbell_row` | 1024×1024 | RGBA / srgba | oui | 206.6 Ko |
| `pull-up.png` | `pull_up` | 1024×1024 | RGBA / srgba | oui | 161.0 Ko |
| `lat-pulldown.png` | `lat_pulldown` | 1024×1024 | RGBA / srgba | oui | 200.0 Ko |
| `dumbbell-curl.png` | `dumbbell_curl` | 1024×1024 | RGBA / srgba | oui | 142.2 Ko |
| `triceps-pushdown.png` | `triceps_pushdown` | 1024×1024 | RGBA / srgba | oui | 173.4 Ko |
| `lateral-raise.png` | `lateral_raise` | 1024×1024 | RGBA / srgba | oui | 138.3 Ko |

Post-traitement des 4 corrigés : masque luminance sur fond noir pur + fermeture 1 px + remplissage des **petits** trous (short) sans remplir les cavités anatomiques (entre bras/barre, entre cuisses) + recadrage centré marges ~7 % + PNG optimisé.

## Lisibilité 56 px / 72 px

- **56 px :** squat, presse, développés, curl, élévations, rowing, deadlift et db-bench restent identifiables. Traction (cage) et pushdown (tour + corde) plus fins mais encore lisibles.
- **72 px :** les 12 lisibles.

## Preuves visuelles

Dans ce dossier :

- `validation/planche-12-fond-noir.png`
- `validation/planche-12-fond-blanc.png`
- `validation/lisibilite-56px.png`
- `validation/lisibilite-72px.png`
- `validation/file-stats.json`

Copies agent : `/opt/cursor/artifacts/exercise-wave1-audit/` (planches, chaque illu noir/blanc, 56/72, crops 100 %, avant/après).

## Non-changé (volontaire)

- `src/assets/exercises/developpe-couche.webp` / `.jpg` — asset validé `bench_press` **non touché**
- `src/utils/exerciseMedia.ts`
- sélecteur d’exercices, flags Convex, Cloudflare, `main`
- 8 illustrations wave1 sans défaut réel : incline, overhead, squat, leg-press, lat-pulldown, curl, triceps-pushdown, lateral-raise

## STOP

Commit + push de `bot/exercise-assets-wave1` uniquement. **Pas de PR, pas d’intégration.** Attendre GO Evan.
