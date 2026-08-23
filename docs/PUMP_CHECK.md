# Pump Check (Victory Camera)

Écran photo post-séance affiché après **Terminer la séance** (nouvelle séance uniquement, pas en mode édition).

## Stack

Ranked Gym est une **PWA Vite + React** (Capacitor pour iOS). Les packages Expo (`expo-camera`, `expo-media-library`, `react-native-view-shot`) ne s'appliquent pas directement ; équivalents web :

| Spec | Implémentation |
|------|----------------|
| Appareil photo | `navigator.mediaDevices.getUserMedia` |
| Overlay + stats | `VictoryCamera.tsx` (React) |
| Export image unique | `exportVictoryCard()` — Canvas 1080×1920 |
| Partager / galerie | Web Share API + téléchargement JPEG |

Les permissions sont documentées dans `app.json` (référence native) et `index.html` (`Permissions-Policy: camera`).

## Flux

1. Train → **Terminer la séance**
2. `VictoryCamera` plein écran (caméra frontale)
3. Capture → aperçu avec filtre Arène + stats (volume, durée, PR)
4. **Partager / Sauvegarder** → JPEG composite
5. **Passer** / ✕ (optionnel) ou **Retour au Lobby** → onglet Lobby

La séance est sauvegardée (local + Supabase) **avant** l’écran photo — le Pump Check n’est jamais bloquant.

Partage iOS : JPEG `image/jpeg` via Web Share (files-only) pour l’aperçu natif ; fallback Capacitor Filesystem cache + Share si disponible.

## Fichiers

- `src/components/training/VictoryCamera.tsx`
- `src/utils/victoryCardExport.ts`
- `src/utils/sessionPrs.ts`
- `src/types/victory.ts`
