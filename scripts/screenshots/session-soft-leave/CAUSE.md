# Soft-leave séance immersive → Train (Reprendre)

## Cause exacte

Le retour depuis l’écran immersif n’était **pas** une action de navigation/persistance de premier niveau.

1. **`goHub()`** ne faisait qu’un flip React `panel: 'notebook' → 'hub'` — sans flush du brouillon, sans marqueur volontaire, sans historique navigateur.
2. Le debounce brouillon (700 ms) était **annulé à l’unmount** sans flush → risque de perdre kg/reps saisis juste avant la flèche.
3. **`setChromeHidden(true)`** (séance immersive) appelait `dismiss()` sur le repos → wipe du snapshot `endsAt` au Reprendre.
4. Aucun `lastVoluntaryRoute` → impossible de distinguer soft-leave volontaire (rester sur hub + Reprendre) vs retour OS / cold start (rouvrir la séance).
5. Pas de `history.pushState` / `popstate` → retour Android / PWA non câblé (ou boucle / sortie WebView).
6. Index d’exercice immersif non persisté → reprise souvent au mauvais exercice.

## Correctif

- Soft-leave : flush immédiat + `lastVoluntaryRoute: 'train-hub'` + hub Train + brouillon conservé.
- Cold start / visibility sans flag → auto-reopen séance.
- Soft-leave + visibility → **ne** rouvre **pas**.
- Chrome hide **ne dismiss plus** le repos ; Pump Check appelle `dismiss()` explicitement.
- Historique : une entrée séance, `popstate` = même soft-leave que la flèche.
- `activeExerciseIndex` persisté sur `activeWorkoutDraft`.
- Seul **Terminer la séance** clôture (`activeWorkoutDraft` + `lastVoluntaryRoute` → null).

## Fichiers modifiés (code)

- `src/components/training/TrainingView.tsx`
- `src/components/training/WorkoutNotebook.tsx`
- `src/components/training/VictoryCamera.tsx`
- `src/context/RestTimerContext.tsx`
- `src/services/trainingStorage.ts`
- `src/types/training.ts`
- `src/utils/trainHub.ts`
- `src/utils/sessionBackNav.ts` (nouveau)
- `scripts/train-hub-capture/main.tsx`
- `scripts/prove-session-soft-leave.mjs` (nouveau)
- `scripts/test-train-hub-browser.mjs`

## Tests exécutés

| Suite | Résultat |
|-------|----------|
| `src/utils/sessionBackNav.test.ts` | OK |
| `src/utils/trainHub.test.ts` (dont séance libre vide → Reprendre) | OK |
| `src/services/trainingResume.test.ts` (soft-leave / Terminer / endsAt) | OK |
| `src/context/RestTimerContext.chromeHide.test.tsx` | OK |
| `src/components/training/WorkoutNotebook.repair.test.tsx` | OK |
| `node scripts/prove-session-soft-leave.mjs` | `SOFT_LEAVE_OK` |
| `node scripts/test-train-hub-browser.mjs` | parcours soft-leave / Reprendre / rest / reload OK |

## Preuves (ce dossier)

| Fichier | Contenu |
|---------|---------|
| `soft_leave_01_hub_reprendre.png` | Hub Train — carte Push + **Reprendre** |
| `soft_leave_02_session_edited.png` | Immersif — série 2 à **77.5** kg |
| `soft_leave_03_hub_after_back.png` | Après flèche retour — hub + **Reprendre** (séance non terminée) |
| `soft_leave_04_restored.png` | Reprendre — **77.5** restauré |
| `soft_leave_session_back_to_reprendre.mp4` | Démo courte leave → hub → reprise |

## Git

- Base : `49e4be838c146f71e00a769eaafb49046c859d0e` (`origin/bot/migrate-supabase-to-convex`)
- Branche : `bot/fix-session-back-nav`
- **Pas de PR / merge / deploy** jusqu’au GO Evan
