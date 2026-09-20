# Diagnostic — hero immersif absent (Ranked Gym)

**Branche:** `bot/fix-workout-immersive-hero`  
**Base:** `3728ebab0e4efdceefefdd879b36d6c027780cd3` (`origin/bot/migrate-supabase-to-convex`, merge immersif #39)

## Cause exacte (pas une hypothèse)

1. **Lookup média = slug du titre affiché** (`resolveExerciseMedia(exercise.name)`).
2. Séance réelle Evan : titre **« DÉVELOPPER »** → `exerciseSlug` → **`developper`**.
3. Table d’assets / alias ne contenait que `developpe-couche` / `bench-press` / etc. **Pas** `developper`.
4. Résultat : `imageSrc: null` → UI rendait un rectangle **`bg-[#121214]`** sur toute la hauteur hero → **zone supérieure noire opaque**.
5. Les captures précédentes utilisaient une fixture hardcodée **« Développé couché »** (3/8, 80 kg…) qui **matchait** l’asset → fausse preuve vs runtime.

## Ce que ce n’est PAS

| Hypothèse | Verdict |
|-----------|---------|
| 404 / MIME / asset manquant au build | **Non** — `src/assets/exercises/developpe-couche.webp` est importé Vite et hashé dans `dist/assets/` (voir `prod-hero-diag.json`). |
| CSP bloquant l’image | **Non** — `img-src 'self'` autorise les assets hashed same-origin. CSP **non affaiblie**. |
| Casse Linux/CF du fichier | **Non** — chemin kebab-case stable. |
| Bug CSS opacity/height/z-index sur `<img>` | **Non** — `<img>` n’était **pas monté** (`showImage === false`). |
| Rename automatique « DÉVELOPPER » → bench | **Interdit** / non fait — trop ambigu. |

## Gap métadonnée

`ExerciseEntry` n’avait **pas** de type canonique. Ajout **additif** optionnel : `canonicalExerciseId?: string` (ex. `bench_press`).  
Sans ce champ, titre libre « DÉVELOPPER » → **fallback neutre** + données réelles (1/1, 20×8). Photo seulement si ID/slug fiable.

## Preuves

- `real-developper-*-diag.json` — hero=`fallback`, slug=`developper`, titre=DÉVELOPPER
- `canonical-bench-*-diag.json` — hero=`ready`, photo Vite, network 200 webp
- `prod-hero-diag.json` — asset présent après `vite build` + `vite preview`
