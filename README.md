# Ranked Gym

Progressive Web App mobile-first — réseau social de musculation gamifié.

## Stack

- **React 19** + **TypeScript**
- **Vite 8**
- **Tailwind CSS 4**
- **lucide-react** (icônes)
- **vite-plugin-pwa** (PWA)

## Démarrage

```bash
npm install
npm run dev
```

Ouvre [http://localhost:5173](http://localhost:5173) dans ton navigateur (mode mobile recommandé via DevTools).

## Structure

```
src/
├── components/
│   ├── home/        # Vue Accueil
│   ├── lobby/       # Vue Lobby (check-in + membres présents)
│   ├── profile/     # Vue Profil (rank, XP)
│   ├── training/    # Vue Entraînement
│   ├── layout/      # AppLayout + BottomNav
│   └── ui/          # Composants réutilisables
├── data/            # Mock data
└── types/           # Types TypeScript
```

## Fonctionnalités

- Navigation bottom bar : Accueil, Lobby, Entraînement, Profil
- **Lobby** : Google Places Nearby Search (gym / fitness_center) + check-in + membres actifs
  - Sans `VITE_GOOGLE_MAPS_API_KEY` → mode simulation (salles Tergnier mock)
- **Profil** : avatar, rank, barre XP
- Design dark « Hero & Arena » (crimson + glassmorphism)

## Configuration Google Maps

Copie `.env.example` vers `.env` et renseigne ta clé :

```bash
VITE_GOOGLE_MAPS_API_KEY=ta_cle_ici
```

Active **Places API** et **Geocoding API** sur Google Cloud. Tant que la clé est vide, l’app affiche 3 salles mock autour de ta position.

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production + PWA |
| `npm run preview` | Prévisualiser le build |
