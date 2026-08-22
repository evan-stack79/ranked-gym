# Déploiement Cloudflare Pages — Ranked Gym

## Erreur « Missing entry-point to Worker script »

Tu utilises **`wrangler deploy`** (Workers) au lieu de **`wrangler pages deploy`** (Pages).

Ce projet est une **SPA Vite** → **Cloudflare Pages**, pas un Worker seul.

---

## Configuration dashboard (recommandé — Git connecté)

Dans **Workers & Pages → ranked-gym → Settings → Builds** :

| Champ | Valeur |
|--------|--------|
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Deploy command** | *(laisser vide)* |

Ne mets **pas** `wrangler deploy` nulle part.

Variables d’environnement (Production) :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`

---

## Déploiement CLI (optionnel)

```bash
npm run deploy:cloudflare
# = npm run build && wrangler pages deploy dist --project-name=ranked-gym
```

Secrets requis en local : `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID` si besoin).

---

## Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `wrangler.toml` | Config Pages (`pages_build_output_dir = "./dist"`) + Functions |
| `functions/_middleware.ts` | Middleware Pages (Content-Type HTML) |
| `public/_headers` | MIME types statiques |
| `package.json` → `pages:deploy` | Commande correcte : `wrangler pages deploy dist` |
