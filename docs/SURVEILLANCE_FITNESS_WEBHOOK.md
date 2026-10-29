# Surveillance fitness — webhook Convex → Grok Bot

Branche les événements produit « Surveillance fitness » vers une routine Grok Bot
via un webhook HTTP. **Toute la logique et les secrets restent côté Convex** —
portable web / IPA / APK sans secret client.

> Ne pas committer de valeurs d’env. Le Studio Manager pose les variables et
> déploie Convex (`npx convex deploy` n’est **pas** fait depuis ce dépôt).

## Variables d’environnement (Convex)

| Nom | Rôle |
| --- | --- |
| `SURVEILLANCE_FITNESS_WEBHOOK_URL` | URL HTTPS du webhook Grok Bot |
| `SURVEILLANCE_FITNESS_WEBHOOK_KEY` | Clé Bearer (`Authorization: Bearer <clé>`) |
| `SURVEILLANCE_FITNESS_BETA_MODE` | Optionnel — `true`/`1`/`yes` → inscriptions en `beta_signup` |
| `CONVEX_ALLOW_PUBLIC_SIGNUP` | Si vrai, traité comme mode bêta pour le type d’inscription |

Si **URL ou clé absente** : log soft (`[surveillance-fitness] …`), événement
conservé / livraison reportée, **jamais** d’erreur utilisateur.

## Types d’événements (`type`)

| `type` | Déclencheur |
| --- | --- |
| `signup_free` | Inscription compte (email ou Google **nouveau**) hors mode bêta |
| `beta_signup` | Même hook, si `SURVEILLANCE_FITNESS_BETA_MODE` ou `CONVEX_ALLOW_PUBLIC_SIGNUP` |
| `first_meal_photo_ai` | Premier scan repas IA **réussi** (`mealPhotoAi.analyzeMealPhoto`) |
| `first_workout` | Première séance : `recordActivity` (`activityType=workout`) **ou** sync `workouts.stateJson.completed.length > 0` |
| `churn` | Cron quotidien — inactivité ≥ seuil (voir ci-dessous) |
| `test` | Mutation / action de test manuel |

**Un seul envoi par couple `(userId, type)`** pour les « premiers » et le churn
(table `surveillance_fitness_events`, index `by_userId_type`). Les retries
suivent le même esprit qu’avis bêta (jusqu’à 4 essais).

## Payload JSON (minimum)

```json
{
  "type": "signup_free",
  "email": "user@example.com",
  "last_active_days": 0,
  "action_count": 0,
  "plan": "free",
  "occurred_at": "2026-10-29T12:00:00.000Z",
  "user_id": "uuid-optionnel"
}
```

- Header : `Authorization: Bearer <SURVEILLANCE_FITNESS_WEBHOOK_KEY>`
- `Content-Type: application/json`
- `plan` : `free` | `beta` | `unknown`
- Champs utiles déjà dispo : `occurred_at`, `user_id`

## Seuil churn

Constante code : **`SURVEILLANCE_FITNESS_CHURN_DAYS = 14`**
(`convex/lib/surveillanceFitnessWebhook.ts`).

Cron : `convex/crons.ts` — quotidien **06:15 UTC** →
`surveillanceFitness.scanSurveillanceFitnessChurn`.

Activité retenue = max de `auth_users.updatedAt/createdAt`, `profiles`,
`workouts_state`, `nutrition_state`, `streak_state`, sessions encore valides.

## Comment tester (après env + deploy Studio Manager)

1. Poser `SURVEILLANCE_FITNESS_WEBHOOK_URL` + `SURVEILLANCE_FITNESS_WEBHOOK_KEY`
   dans le dashboard Convex (prod / staging).
2. Déployer le backend Convex (**Studio Manager**).
3. **Test session** (utilisateur connecté) :
   - Mutation publique `surveillanceFitness:sendTestSurveillanceFitnessWebhook`
   - args : `{ sessionToken: "<token>" }` → planifie `type=test` (force).
4. **Test interne** (dashboard / CLI Convex, sans session) :
   - Action interne `surveillanceFitness:sendTestSurveillanceFitnessWebhookInternal`
   - args : `{ email: "toi@example.com", userId?: "…" }` → POST immédiat `type=test`.
5. Vérifier la réception côté Grok Bot et les logs Convex
   (`[surveillance-fitness]`).

## Fichiers clés

- `convex/lib/surveillanceFitnessWebhook.ts` — helper POST + payload
- `convex/surveillanceFitness.ts` — schedule, deliver, retries, churn, test
- `convex/crons.ts` — job churn
- Hooks : `convex/auth.ts` (signup), `convex/mealPhotoAi.ts`,
  `convex/rpc.ts` (`recordActivity`), `convex/sync.ts` (completed workouts)

## Portabilité web / IPA / APK

Aucun secret webhook dans le client. Les apps (PWA, iOS, Android) ne font
qu’appeler les APIs Convex habituelles ; la livraison webhook est 100 % serveur.
