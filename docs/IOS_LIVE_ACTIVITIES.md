# Live Activities iOS — Chrono de repos (Dynamic Island)

Ranked Gym est une **PWA Vite** déployée sur Cloudflare. Les Live Activities (ActivityKit) nécessitent la **coque native iOS** Capacitor. Le code web appelle le plugin ; le rendu lock screen / Dynamic Island est natif.

## État d’intégration (Capacitor)

| Élément | Emplacement |
|---|---|
| Plugin Capacitor | `ios/App/App/Plugins/RestTimerLiveActivity/RestTimerLiveActivityPlugin.swift` |
| Attributes partagés | `ios/App/App/Plugins/RestTimerLiveActivity/RestTimerAttributes.swift` |
| Widget / Dynamic Island | `ios/App/RestTimerLiveActivityWidget/RestTimerLiveActivityWidget.swift` |
| Flag Live Activities | `ios/App/App/Info.plist` → `NSSupportsLiveActivities` = `true` |
| Pont React | `src/services/restTimerLiveActivity.ts` (`registerPlugin('RestTimerLiveActivity')`) |

Les sources sous `ios-native/` sont des **références / README** ; la source de vérité compilée est sous `ios/App/`.

## Prérequis

- macOS + Xcode 15+
- iOS 16.2+ sur l’appareil de test (Widget Extension)
- Capacitor iOS déjà configuré (`ios/`)

## Pont React → Swift

`RestTimerContext` appelle :

| Événement JS | Action native |
|---|---|
| `startRestLiveActivity({ remainingSec, totalSec, subtitle })` | `RestTimerLiveActivity.start()` |
| Tick / pause | `update({ remainingSec, subtitle? })` |
| Fin / Passer / OK | `end({ immediate: true })` |

Sans shell Capacitor, le bridge est un **no-op** : le timer in-app continue de fonctionner.

## BPM caméra (séparé)

La mesure **BPM** (PPG caméra) n’utilise pas la Dynamic Island. Elle passe par `CameraHeartRate` :

- Swift : `ios/App/App/Plugins/CameraHeartRatePlugin.swift`
- React : `src/native/cameraHeartRate/`

## Build IPA CI

Workflow unsigned : `.github/workflows/build-ipa.yml` (`macos-latest`, `CODE_SIGNING_ALLOWED=NO`, artifact `.ipa`).

### Secrets obligatoires (sinon bandeau rouge au lancement)

L’IPA build force **Convex** (`VITE_ENABLE_CONVEX_AUTH=true` + `VITE_ENABLE_CONVEX_PRIMARY=true`).
Vite fige `VITE_*` au `npm run build`. Sans `VITE_CONVEX_URL`, l’app affiche
« Connexion au service indisponible » même avec du Wi‑Fi.

Dans **GitHub → Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|--------|--------|
| `VITE_CONVEX_URL` | `https://….convex.cloud` (voir `docs/CONVEX_SETUP.md`) |

Optionnel : `VITE_PUBLIC_APP_URL`, `VITE_GOOGLE_MAPS_API_KEY`.
Puis relance **Build IPA** et réinstalle l’artifact.

> Note code : le runtime web/Cloudflare peut encore avoir Supabase en défaut
> (`VITE_ENABLE_CONVEX_AUTH` false) tant que le cutover global n’est pas fait.
> L’IPA n’emprunte plus ce chemin.

## UI Live Activity (dark)

- Titre : **Temps de repos**
- Sous-titre : exercice + série
- Compte à rebours `MM:SS` en rouge (Dynamic Island + lock screen)
