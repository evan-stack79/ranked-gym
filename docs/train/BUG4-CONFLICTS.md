# Conflits métier exposés — validation série (BUG 4)

Avant correctif, règles en conflit avec l’attendu Evan :

| Règle actuelle | Attendu | Décision prise |
|----------------|---------|----------------|
| Effort **facultatif** ; validate **uniquement** via bouton | Effort 1–10 après kg+reps **valide auto** | Auto-validate si effort saisi ; bouton conservé si effort manquant / a11y |
| Rest **skip** → `addNextSet: true` (crée une série) | **Jamais** créer une série auto | `addNextSet: false` toujours |
| Après dernière série : bouton disabled | Rester + proposer ajout série **ou** exo suivant | CTA « Exercice suivant » / « + Exercice » |
| Effort done en lecture seule | Permettre de corriger | Effort toujours éditable |

Soft-leave / bandeau / Reprendre (#42) : **inchangés**.
