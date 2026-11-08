# Licences tiers — données, assets et dépendances portés

Inventaire des licences pour le port `cursor/radix-on-ciqual-f31a` → branche de port IPA.
**Ne pas inventer une licence** : si inconnue, la ligne est marquée **INCONNUE** (à trancher avant merge).

## Données nutrition

| Élément | Fichiers | Licence | Attribution / notes |
|---|---|---|---|
| Table Ciqual 2020 (ANSES) — énergie kcal/100 g | `src/data/ciqualKcal2020.json`, `src/data/README_CIQUAL.md`, `src/services/ciqualCatalog.ts` | **Licence Ouverte 2.0 (Etalab)** | Attribution UI : « Source : ANSES, table Ciqual 2020 ». Dataset data.gouv / ANSES. Copie embarquée extraite d’une archive web (07/07/2020) — retélécharger depuis la source officielle avant mise en ligne prod. |
| Open Food Facts (France) | `convex/lib/offSearch.ts`, UI `AddFoodScreenV3.tsx` | **ODbL** (+ Database Contents License pour les contenus) | Attribution UI : « Données Open Food Facts · licence ODbL ». Recherche via `https://fr.openfoodfacts.org` côté Convex uniquement. Contribuer les corrections sur openfoodfacts.org. |

## Sons

| Élément | Fichiers | Licence | Notes |
|---|---|---|---|
| Chime fin de repos (web) | `public/sounds/rest_timer_chime.mp3` | **INCONNUE** | Ajouté dans le commit ESSAI `3d12b24` sans mention de licence ni auteur externe. |
| Chime fin de repos (natif iOS) | `ios/App/App/Plugins/RestTimerSound/rest_timer_chime.caf` | **INCONNUE** | Même provenance que le MP3 (conversion CAF). |
| Silence / placeholder natif | `ios/App/App/Plugins/RestTimerSound/rest_timer_silent.caf` | **INCONNUE** | Même dossier plugin ; pas de licence documentée. |
| Bips countdown 3-2-1 | générés Web Audio / AVAudioEngine (pas de fichier) | n/a (code Ranked Gym) | Oscillateur synthétique dans `src/utils/restTimerSound.ts` / plugin Swift. |

## Illustrations / brand

| Élément | Fichiers | Licence | Notes |
|---|---|---|---|
| Illustrations exercices waves 2–5 (3D graphite) | `assets/exercises/illustrations/wave{2,3,4,5}/` | **INCONNUE** | README de série sans licence ni auteur. Style aligné wave1 ; pas de contrat/licence dans le dépôt. |
| Illustrations wave1 | `assets/exercises/illustrations/wave1/` | **INCONNUE** | Idem ; README indique « STOP — attendre GO Evan » à l’origine. |
| Sources brand panthère (calm / roar / icon) | `src/assets/brand/sources/*`, `public/brand-header-mark*.png`, splash | **Propriétaire Ranked Gym** (d’après `MANIFEST.json` : « Copies des sources propriétaires ») | Pas de licence open-source tierce. |
| Vidéos form-guide | `assets/exercises/form-videos/` | n/a pour l’instant | README convention seulement ; aucune vidéo déclarée / bundlée dans ce port. |

## Polices

| Élément | Fichiers | Licence | Notes |
|---|---|---|---|
| UI system fonts | `src/index.css`, `index.html` | n/a (stack système) | `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text/Display`, `system-ui`. Aucune police tierce embarquée par ce port. |

## Dépendances npm (delta pertinent)

| Package | Rôle | Licence (npm) |
|---|---|---|
| `@capacitor/status-bar` | Overlay StatusBar / safe-area iOS (base #143) | MIT |
| `sharp` (déjà présent) | Scripts brand assets (`scripts/generate-brand-assets.mjs`) | Apache-2.0 |
| `html5-qrcode` (déjà présent) | Scan barcode nutrition | Apache-2.0 |

Aucune nouvelle dépendance npm **propre** au port radix nutrition/son/DI au-delà de ce qui était déjà sur main / #143.

## Plugins / code natif (pas de licence tierce)

- `RestTimerSoundPlugin`, `RestTimerLiveActivityPlugin`, widget ActivityKit, `WebShellCache.swift` : code Ranked Gym (Capacitor / Apple frameworks).
