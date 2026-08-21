# Configuration Supabase — Ranked Gym

Guide pour que tes données (nutrition, entraînements, profil, check-ins) vivent dans le **cloud**, pas seulement dans le navigateur. Ainsi, même si le lien Cloudflare change, tu te reconnectes et **tout revient**.

## 1. Créer un projet sur Supabase.com

1. Va sur [https://supabase.com](https://supabase.com) → crée un compte (GitHub OK).
2. Clique **New project**.
3. Remplis :
   - **Name** : `ranked-gym` (ou autre)
   - **Database password** : choisis-en un fort et **note-le**
   - **Region** : `Frankfurt` / Europe (proche de toi)
4. Clique **Create new project** et attends ~1–2 min.

## 2. Récupérer l’URL et la clé API

1. Dans le projet : icône **Project Settings** (engrenage) → **API**.
2. Copie :
   - **Project URL** → ex. `https://abcdefghijk.supabase.co`
   - **anon public** / **Publishable** key → longue clé (commence souvent par `eyJ…` ou `sb_publishable_…`)

3. Dans ton repo, fichier `.env` à la racine :

```bash
VITE_SUPABASE_URL=https://TON_REF.supabase.co
VITE_SUPABASE_ANON_KEY=ta_clé_anon_ici
```

4. **Redémarre** le serveur (`Ctrl+C` puis `npm run dev`) — Vite ne lit `.env` qu’au démarrage.

> N’utilise **jamais** la clé `service_role` dans le front. Seulement l’`anon` / publishable.

## 3. Créer les tables (SQL Editor) — obligatoire

1. Dashboard → **SQL Editor** → **New query**.
2. Ouvre le fichier du repo [`supabase/schema.sql`](../supabase/schema.sql).
3. **Copie-colle TOUT** le contenu dans l’éditeur.
4. Clique **Run** (en bas à droite).

Tu dois voir un succès sans erreur rouge.

### Tables créées

| Table | Rôle |
|--------|------|
| `profiles` | Utilisateur (pseudo, level, xp, rank, discipline, spots custom, check-in actif) |
| `workouts` | Tout le Train (carnet, séances, routines, progression) |
| `nutrition` | Profil calories + journal des repas |
| `checkins` | Historique des check-ins lobby / spots |
| `aliments` | Cache produits scannés (optionnel) |

Chaque table a des **RLS** : un user ne lit / n’écrit **que** ses lignes.

Un **trigger** crée automatiquement `profiles` + lignes vides `workouts` / `nutrition` à l’inscription.

## 4. Auth email (dev)

1. **Authentication → Providers → Email** : activé.
2. Pour tester facilement : **Confirm email = OFF**.
3. **Authentication → URL Configuration** :
   - **Site URL** = l’URL actuelle de l’app (`http://localhost:5173` ou ton tunnel / domaine)
   - **Redirect URLs** = ajoute la même origine (+ `https://*.trycloudflare.com/**` si tu testes via tunnel)

## 5. Vérifier que ça marche

1. Ouvre l’app → **Profil** → inscris-toi (email + mdp).
2. Ajoute un repas, une séance, un check-in.
3. Dans Supabase → **Table Editor** :
   - `profiles` → 1 ligne
   - `nutrition` / `workouts` → se remplissent après quelques secondes (sync auto)
   - `checkins` → une ligne par check-in
4. Change d’URL (nouveau tunnel) → reconnecte-toi avec le **même compte** → tes données **reviennent**.

## 6. Comment l’app synchronise

- **Connecté** : chaque modification → sauvegarde auto dans Supabase (`workouts`, `nutrition`, `profiles`, `checkins`).
- **À la connexion** : l’app **tire d’abord le cloud** (source de vérité), puis écrit le cache local.
- Le `localStorage` n’est plus qu’un **cache rapide** (scopé par user). Si l’URL change et vide le navigateur, le cloud restaure tout au login.

## Checklist

- [ ] Projet Supabase créé
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` dans `.env`
- [ ] `supabase/schema.sql` exécuté (Run OK)
- [ ] Confirm email OFF (dev)
- [ ] `npm run dev` redémarré
- [ ] Inscription → rows visibles dans Table Editor
- [ ] Test “nouvelle URL + reconnexion” → données OK

## Déploiement (domaine fixe ~10 €/an)

1. Héberge sur Cloudflare Pages / Vercel (`npm run build`, dossier `dist`).
2. Mets les mêmes variables d’env dans le dashboard d’hébergement.
3. Mets à jour Site URL + Redirect URLs Supabase avec ton domaine.
