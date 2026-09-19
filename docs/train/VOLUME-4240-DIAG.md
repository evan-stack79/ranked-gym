# Diagnostic — volume 4240 kg (BUG 7)

**Branche:** `bot/fix-session-labels-media-food`

## Formule exacte (`src/utils/strength.ts`)

```
totalVolume(sets) = round( Σ (reps × weightKg) )
exercisesVolume(exercises) = totalVolume(all sets flatMapped)
```

- **Toutes** les séries conservées au save (`reps > 0 && weightKg >= 0`) — y compris non-`done`.
- **Pas** de ×2 haltères.
- **Pas** d’injection du poids de corps dans le volume (le BW sert uniquement aux kcal).
- Séries supprimées avant save : exclues. Séries modifiées : dernière valeur.

## Verdict 4240

`4240` est un total **valide** de `Σ reps×kg` (ex. test : 10×80 + 10×80 + 8×80 + 8×80 + 10×60 + 10×60 + 8×20 = 4240).

**Aucune correction de formule** — le chiffre reproduit les données saisies.
Si un double comptage opérationnel apparaît (saisie totale vs par main), c’est côté utilisateur, pas code.
