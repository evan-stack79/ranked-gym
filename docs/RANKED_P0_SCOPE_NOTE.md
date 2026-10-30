# Ranked P0 — notes de scope (Studio Manager)

Réf. : `SPEC_RANKED.md` · `MATRICE_SCIENTIFIQUE_RANKED_FORCE.md` · `ARCHI_RANKED.md`

## Inclus P0
- Ranked Force + Ranked Discipline (opt-in 18+)
- 5 lifts, Epley, plafonds, anomalies, badge Vérifié
- Classement **amis**
- Ligues + soft reset cycle (cron)
- Cosmétique Bronze→Légende (`src/utils/rank.ts`) **inchangé**

## Hors scope (écarts documentés)
| Lot | Statut |
|-----|--------|
| **P0-bis classement salle** | Hors premier binaire — pas de code gym membership / Places |
| Saisons formelles / clans / vidéo PR obligatoire | P1 |
| IAP sur le rang / bodyweight / look / âge bio | Interdits |

Pas de merge / pas de `npx convex deploy` prod sans GO Evan.
