# Ranked Gym — outil partenaire (caisse)

App web **séparée** de l’app joueur Capacitor. Flow : Login → code → Oui donné / Non rupture.

Specs : `docs/ARCHI_OUTIL_PARTENAIRE.md` · deploy VPS : `docs/PARTNER_TOOL_DEPLOY.md`.

```bash
npm install
cp .env.example .env.local   # set VITE_CONVEX_URL
npm run dev                  # http://localhost:5180
npm run build
```

UI interdite : Force, Discipline, ligue, €, solde pts, boutique joueur.  
Banner OP-F09 fixe en tête de chaque écran.
