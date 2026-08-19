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
- **Lobby** : simulation géolocalisation + check-in + liste de membres actifs
- **Profil** : avatar, rank (Platine Niv. 42), barre XP
- Design dark mode futuriste (néon vert/bleu)

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production + PWA |
| `npm run preview` | Prévisualiser le build |
