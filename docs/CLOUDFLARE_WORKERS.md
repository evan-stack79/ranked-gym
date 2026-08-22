# Déploiement Cloudflare Workers (Git) — Ranked Gym

Tu utilises **Workers + assets statiques** (`ranked-gym.lembrezevan.workers.dev`), pas Pages.

## Configuration Build (dashboard)

**Workers & Pages → ranked-gym → Settings → Build**

| Champ | Valeur |
|--------|--------|
| **Build command** | `npm run build` |
| **Deploy command** | `npx wrangler deploy --config wrangler.jsonc` |
| **Version command** | *(vide)* |
| **Production branch** | `main` |

❌ Ne mets **pas** `echo "ok"` (ne déploie rien).  
❌ Ne mets **pas** `npx wrangler deploy` seul (Wrangler relance un 2ᵉ build Vite auto).

## Variables d'environnement — **Build** (obligatoire)

**Settings → Variables and Secrets** → onglet / section **Build** (ou Production au moment du build) :

| Variable | Valeur |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://jivqfrkwvnzzefnerpii.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé **anon public** (`eyJ…`) |
| `VITE_GOOGLE_MAPS_API_KEY` | optionnel |

Colle l'URL depuis **Supabase → API → Copy** (texte brut, pas depuis le chat).

Les `VITE_*` sont **figées au build** : après modification → **Create deployment**.

## Vérifier qu'un déploiement a pris le bon code

Dans les logs de build, cherche :

| Indicateur | Ancien (cassé) | Nouveau (OK) |
|------------|----------------|--------------|
| `dist/index.html` | ~0,95 kB | ~2 kB |
| JS bundle | `index-CsKrJLVD.js` | autre hash (ex. `index-D1NO9lTv.js`) |

Si tu vois encore `index-CsKrJLVD.js` → mauvais commit ou cache.  
**Deployments → Create deployment** sur le dernier commit `main`, ou vide le cache build.

## Commit déployé

Le déploiement doit pointer sur **`e76d942`** ou plus récent (fix URL Supabase + sanitize Markdown).
