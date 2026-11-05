# Déploiement outil partenaire (OP-d) — VPS Evan

**Statut :** préparation code livrée ; **pas de déploiement live** dans la PR OP-a/b/c.  
Sous-domaine exact encore ouvert (`partners.…`) — Studio / Evan confirment avant cutover.

Réf. : `ARCHI_OUTIL_PARTENAIRE.md` §2 · PRD §OP · CA-OP5.

---

## 1. Principe

| Site | Origine | Contenu |
|------|---------|---------|
| Marketing Ranked Gym | site public existant | Landing / SEO — **sans** droits mutations partenaire |
| **Outil partenaire** | **2ᵉ vhost / sous-domaine** | SPA `partner-tool/` → Convex HTTPS only |
| App joueur | Capacitor / Pages | Boutique joueur — **pas** de markConsumed / partnerRefuse |

---

## 2. Build local (préparation)

```bash
cd partner-tool
cp .env.example .env.local   # VITE_CONVEX_URL=https://….convex.cloud
npm install
npm run build                # → partner-tool/dist
```

Le bundle public ne contient **que** `VITE_CONVEX_URL`.  
**Interdit** : clé admin, deploy key Convex, mots de passe, `PARTNER_TOOL_ORIGIN` secrets côté client.

---

## 3. Variables

### VPS (document root partenaire)

| Variable | Où | Notes |
|----------|-----|--------|
| `VITE_CONVEX_URL` | build-time `.env` / CI | URL HTTPS deployment Convex |
| (aucune clé admin) | — | jamais dans le bundle |

### Convex dashboard (env déploiement)

| Variable | Exemple | Notes |
|----------|---------|--------|
| `PARTNER_TOOL_ORIGIN` | `https://partners.example.com` | Whitelist CORS http.ts ; comma-separated si staging+prod |
| — | — | Origine marketing **absente** de cette liste |

Placeholder code : `https://partners.example.com` (`convex/lib/partnerCors.ts`).

---

## 4. Vhost Nginx (exemple)

Sous-domaine distinct du site marketing. Remplacer `partners.example.com` après GO Evan.

```nginx
server {
  listen 443 ssl http2;
  server_name partners.example.com;

  # TLS — Let's Encrypt / cert existant
  # ssl_certificate     /etc/letsencrypt/live/partners.example.com/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/partners.example.com/privkey.pem;

  root /var/www/ranked-gym-partner-tool/dist;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Pas de reverse-proxy vers l’app joueur ni le site marketing
  add_header X-Robots-Tag "noindex, nofollow" always;
}
```

HTTP → HTTPS redirect sur le même `server_name` uniquement.

---

## 5. Checklist cutover (hors cette PR)

1. Evan confirme sous-domaine (`partners.…` ou domaine distinct).  
2. DNS A/AAAA → VPS Evan.  
3. TLS (certbot).  
4. `PARTNER_TOOL_ORIGIN` sur Convex = origine finale.  
5. Build `partner-tool` avec `VITE_CONVEX_URL` prod.  
6. Rsync / deploy `dist/` vers document root du 2ᵉ vhost.  
7. Smoke : login → lookup → Oui/Non ; vérifier CORS health `GET /partner-tool/health` sur Convex HTTP.  
8. **Ne pas** `npx convex deploy` depuis cette PR sans GO explicite.

---

## 6. Comptes

- `partner_staff` / `partner_admin` : invite one-shot (`partnerAuth.createInvite` → `acceptInvite`).  
- `rg_admin` : création **manuelle** only (`partnerAuth.createRgAdminInternal`) — pas d’auto-inscription.  
- Joueur app ≠ compte partenaire (pas de SSO).
