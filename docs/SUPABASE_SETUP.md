# Configuration Supabase — Ranked Gym

Guide pas à pas pour brancher l’auth réelle + la base de données.

## 1. Créer un projet Supabase (gratuit)

1. Va sur [https://supabase.com](https://supabase.com) et crée un compte.
2. Clique **New project**.
3. Choisis une organisation, un **Project name** (ex: `ranked-gym`), un **Database password** (garde-le), et une région proche (ex: `Frankfurt` / `eu-central-1`).
4. Attends que le projet soit prêt (1–2 min).

## 2. Récupérer `SUPABASE_URL` et `SUPABASE_ANON_KEY`

1. Dans le dashboard du projet : **Project Settings** (icône engrenage) → **API**.
2. Copie :
   - **Project URL** → `VITE_SUPABASE_URL`  
     Exemple : `https://abcdefghijk.supabase.co`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`  
     (longue clé JWT qui commence souvent par `eyJ...`)
3. Dans ton repo, édite `.env` :

```bash
VITE_SUPABASE_URL=https://TON_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

4. Redémarre Vite (`npm run dev`) — Vite ne recharge les `.env` qu’au démarrage.

> Ne commit jamais la `service_role` key. L’app front n’utilise **que** l’`anon` key.

## 3. Créer les tables (SQL Editor)

1. Dashboard → **SQL Editor** → **New query**.
2. Colle tout le contenu de [`supabase/schema.sql`](../supabase/schema.sql).
3. Clique **Run**.

Ce script crée :

| Table | Colonnes clés |
|-------|----------------|
| `profiles` | `id`, `pseudo`, `level`, `xp`, `rank`, `discipline` |
| `checkins` | `id`, `user_id`, `salle_nom`, `salle_lat`, `salle_lng`, `created_at` |
| `aliments` | `id`, `nom`, `calories`, `proteines`, `glucides`, `lipides`, `barcode` |
| `user_backups` | `user_id`, `payload` (json Nutri/Train/Force), `updated_at` |

Il active aussi :

- un **trigger** `on_auth_user_created` → à chaque inscription, insert automatique dans `profiles` (Niveau 1, Rank Bronze)
- les **RLS** (chaque user ne voit / n’écrit que ses données)

> Si ton projet existait déjà **avant** `user_backups`, exécute aussi [`supabase/user_backups.sql`](../supabase/user_backups.sql) une fois dans le SQL Editor.

## 4. Auth email uniquement

Apple / Google sont retirés de l’app. Auth = **email + mot de passe** seulement.

1. **Authentication → Providers → Email** : activé.
2. En dev : **Confirm email = OFF** (recommandé)  
   Sinon Supabase envoie un mail de validation.  
   Site URL doit être `http://localhost:5173` (pas `:3000`) et Redirect URLs doit contenir ton origine.  
   L’app envoie déjà `emailRedirectTo` = l’URL courante.

## 5. Brancher le code (déjà prêt)

Le front utilise :

- `@supabase/supabase-js` → `src/lib/supabase.ts`
- `signUp` / `signInWithPassword` → `src/services/authService.ts`
- Check-in DB → `src/services/checkinService.ts`
- Aliments + Open Food Facts → `src/services/alimentsService.ts`
- Sauvegarde cloud (Nutri / Train / Force) → `src/services/cloudBackup.ts` + table `user_backups`
- Caméra code-barres → `html5-qrcode` dans `BarcodeScanner`

Après `.env` + SQL + restart :

```bash
npm run dev
```

Test : **Profil** → Inscription email → un row apparaît dans **Table Editor → profiles**.

## 6. Déploiement (prod)

1. Build : `npm run build`
2. Héberge `dist/` sur **Vercel**, **Netlify** ou **Cloudflare Pages**
3. Ajoute les mêmes variables d’env dans le dashboard d’hébergement
4. Mets à jour Site URL + Redirect URLs Supabase avec l’URL de prod
5. Restreins la clé Google Maps (HTTP referrers) sur ton domaine

## Checklist rapide

- [ ] Projet Supabase créé
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` dans `.env`
- [ ] `supabase/schema.sql` exécuté
- [ ] Confirm email OFF (dev) ou flow mail géré
- [ ] `npm run dev` redémarré
- [ ] Inscription test → row `profiles` visible
- [ ] Check-in → row `checkins`
- [ ] Scanner Nutri → caméra + Open Food Facts + row `aliments`
