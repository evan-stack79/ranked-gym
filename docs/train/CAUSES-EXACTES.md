# Causes exactes — bot/fix-session-labels-media-food

**Base:** `e176f42a08be90a4678a7a1f0715cc2f2c474738` (#42 soft-leave + #38 nutrition + picker)  
**Branche:** `bot/fix-session-labels-media-food`  
**Tip:** voir `git log -1`

## BUG 1 — « Biceps » faux
**Cause:** `findActiveStrengthSession` / save / victory utilisaient `routine.label` (ex. routine custom « Biceps ») alors que l’exo validé était `bench_press`.  
**Fix:** `deriveSessionDisplayTitle` — 1 exo → nom catalogue ; multi → titre user sinon « Musculation ». Même source hub / historique / Pump Check.

## BUG 2 — Photo développé couché
**Cause (déjà documentée):** sans `canonicalExerciseId`, titre « DÉVELOPPER » → slug `developper` → pas d’asset. Asset Vite `developpe-couche.webp` OK en build (`dist/assets/developpe-couche-*.webp`).  
**Gap métadonnée:** « DÉVELOPPER » sans canonique → **pas** de rename auto vers bench. Photo si `canonicalExerciseId=bench_press` (picker catalogue).

## BUG 3 — Meta incohérente
**Cause:** `formatCatalogMeta` tronquait à 2 muscles + équipement ; immersif montrait tous les muscles sans équipement.  
**Fix:** `formatExerciseMetaLine(muscles, equipment)` partout → `Pectoraux · Triceps · Épaules · Barre`.

## BUG 4 — Validation série
**Cause:** effort ne déclenchait pas `finishSet` ; skip repos faisait `addNextSet: true`.  
**Conflits exposés:** `docs/train/BUG4-CONFLICTS.md`.  
**Fix:** auto-validate sur effort 1–10 ; `addNextSet: false` ; effort éditable ; CTA exo suivant.

## BUG 5 — Soft-leave
**Préservé** (#42). Preuve : `SOFT_LEAVE_OK` + tests `sessionBackNav`.

## BUG 6 — 250 min / 4h10
**Cause exacte:** `resolvedDurationMin = round(liveElapsedMs/60000)` avec clock **non pausée** pendant soft-leave (wall-clock ~4h10). Pas de `pausedAt`.  
**Politique inchangée** — options dans `docs/train/DURATION-250-DIAG.md`.

## BUG 7 — 4240 kg
**Formule:** `Σ reps×weightKg` (toutes séries sauvées). 4240 reproductible. Pas de bug code — `docs/train/VOLUME-4240-DIAG.md`.

## BUG 8 — Food « Load failed »
**Cause:** `fetch` OFF → Safari `TypeError: Load failed` remontaient via `err.message`.  
**Fix:** `foodSearchErrors` + retry/timeout + UX Réessayer. Jamais de message brut.

## BUG 9 — Sélecteur
**Cause:** `active={index===0}` (faux rouge) ; un seul asset photo → rectangles gris.  
**Fix:** `active={false}` ; glyphes SVG équipement locaux ; photo bench conservée.

## BUG 10
Aucun hardcode de perf / charges / progression ajouté — titres dérivés des exos / catalogue.
