# Diagnostic — durée 4h10 / 250 min (BUG 6)

**Branche:** `bot/fix-session-labels-media-food`  
**Base:** `e176f42a08be90a4678a7a1f0715cc2f2c474738`

## Cause exacte (calcul ayant produit 250 min)

Il n’existe **pas** de champs `pausedAt` / `resumedAt` / `completedAt`.
Le chronomètre utilise (`src/utils/sessionClock.ts`) :

```
liveElapsedMs = elapsedActiveMs
  + (paused ? 0 : max(0, now − runningSince))

liveElapsedMin = ms ≤ 0 ? 0 : max(1, round(ms / 60_000))

resolvedDurationMin = liveElapsedMin > 0 ? liveElapsedMin : estimatedElapsedMin
```

Victory affiche `formatDuration(250)` → **4H 10M**.

### Trace vers 250

1. Soft-leave vers le hub (`markVoluntaryLeaveToTrainHub`) **ne met pas** `paused: true`.
2. Tant que `paused !== true`, le wall-clock continue via `now − runningSince`.
3. Background / restore flush le brouillon mais **ne pause pas** le clock.
4. À la sauvegarde : `TrainingView.sessionDurationMin` → `resolvedDurationMin` → `note.durationMin`.

Donc **250 min = ~4h10 de wall-clock** pendant lesquels le brouillon est resté `paused: false`
(ex. séance démarrée le matin, terminée l’après-midi sans pause explicite).

### Ce que ce n’est PAS

| Hypothèse | Verdict |
|-----------|---------|
| Estimation `sets × 2.5` | Non — ce fallback ne donne 250 que pour ~100 séries |
| Réutilisation d’une ancienne `durationMin` d’une autre note | Non — save écrit `sessionDurationMin` du draft courant |
| Double comptage pause/reprise | Non — pause fige `elapsedActiveMs` et coupe `runningSince` |

## Politique — **aucun changement sans accord**

Options possibles (à trancher) :

1. **Wall-clock actif** (actuel) — soft-leave continue le chrono.
2. **Auto-pause au soft-leave** — retour hub fige le temps.
3. **Auto-pause en background** — `visibilitychange` → pause.

Aucune de ces options n’est appliquée dans ce correctif.
