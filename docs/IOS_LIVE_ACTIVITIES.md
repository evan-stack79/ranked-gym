# Live Activities + Dynamic Island — Ranked Gym

Shell Capacitor iOS uniquement. Web / PWA / Android = **no-op** (pas d’erreur, pas d’UI Island simulée).

## Audit (environnement Cloud Agent Linux)

| Point | État |
|---|---|
| Capacitor | **8.5.0** (`@capacitor/core` / `ios` / `cli`) |
| Projet iOS | Présent (`ios/App`), plugins locaux sous `App/Plugins/` |
| iOS min app | **15.0** (inchangé) — Live Activities gardés derrière `#available(iOS 16.2, *)` |
| Widget Extension min | **16.2** |
| Deep links | Scheme **`rankedgym://`** (`session/active`, `live-activity?action=…`) |
| Source de vérité séance | `activeWorkoutDraft` (`routineId` + `startedAt` → `sessionId`) + `restTimer` |
| Persistance repos | `endsAt` absolu dans trainingStorage (survit refresh / soft-leave) |
| Xcode dans cet env | **Non** |
| Device iOS testable ici | **Aucun** — ActivityKit / Dynamic Island **non testés sur device** |

## Architecture sync retenue

```
JS SoT (activeWorkoutDraft + RestTimerContext)
    │ start / update(endDate) / end / cleanupStale
    ▼
Capacitor RestTimerLiveActivityPlugin (iOS)
    ▼
ActivityKit ←── Widget Extension (SwiftUI Island + Lock Screen)
    │
    │ actions (−15 / +15 / pause / Reprendre)
    ▼
deep link rankedgym://… → AppDelegate enqueue → pending store
    ▼
JS drainPending + applyNativeAction (anti double-tap token)
```

- **Timer** : `restEndsAt` (Date) → `Text(timerInterval:)` SwiftUI — **pas** d’update JS chaque seconde.
- **Actions** : deep links (ouvre l’app + reconcile). Cohérence Swift↔JS garantie car JS reste SoT.
- **App Intents in-Island sans ouvrir l’app** : **non branchés** — exigent App Groups + signing (interdit sans GO Evan). Documenté ci-dessous, pas maquillé.

## Fichiers

| Couche | Chemin |
|---|---|
| Bridge JS typé | `src/native/liveActivity/` |
| Service façade | `src/services/restTimerLiveActivity.ts` |
| Contexte repos | `src/context/RestTimerContext.tsx` (`adjust`, `applyNativeAction`, endDate) |
| Sources Swift canoniques | `ios-native/RestTimerLiveActivity/`, `ios-native/RestTimerLiveActivityWidget/` |
| App iOS branchée | `ios/App/App/Plugins/RestTimer*.swift` |
| Widget Extension | `ios/App/RestTimerLiveActivityWidget/` + target Xcode |
| Sync sources | `scripts/ios-sync-live-activity.sh` |

## Design

OLED noir, charbon, blanc, gris doux, rouge `#FF2B2B` uniquement progression / actions. Logo panthère `PantherMark` (`public/panther-trim.png`). Pas de glass / néon / dégradés déco.

### Dynamic Island

- **Compact** : panthère + temps repos + anneau progress rouge
- **Minimal** : marque panthère
- **Étendu** : logo, REPOS, timer, exo réel, série x/y, barre, pause, −15 s / +15 s

### Lock Screen

Logo + Ranked Gym, exo, série, timer, barre, **Reprendre** → `rankedgym://session/active` (séance active, pas home).

## Cycle de vie

1. Start LA au vrai repos d’une séance `activeWorkoutDraft` (payload = exo/série réels)
2. Update sur pause / reprise / adjust (nouvel `endsAt`)
3. Survive background via `endsAt` persisté
4. End à fin repos / skip / dismiss / fin séance / cleanup stale au launch
5. Jamais de payload hardcodé (« Développé couché », « 01:30 », etc.)

## Manque volontaire (GO Evan requis)

| Élément | Statut |
|---|---|
| App Groups `group.com.rankedgym.app` | Non activé (signing) — pending store fallback UserDefaults |
| App Intents iOS 17 sans ouvrir l’app | Code retiré au profit des deep links (sync SoT) |
| Certificats / provisioning Widget | À faire sur Mac avec le compte Apple |
| Compile Xcode app+extension | Impossible dans cet env Linux |

## Build Mac

```bash
npm run build
bash scripts/ios-sync-live-activity.sh
npx cap sync ios
npx cap open ios
# Vérifier target RestTimerLiveActivityWidget embarqué, NSSupportsLiveActivities=true
# Device iOS 16.2+ (Island : iPhone 14 Pro+)
```

`npx cap sync ios` : ne wipe pas `App/Plugins/` ni le target Widget s’ils sont dans le pbxproj.

## Web / Android

`registerPlugin(..., { web: LiveActivityWeb })` → `available: false`. Aucune régression UI.
