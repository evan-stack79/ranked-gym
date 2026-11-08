# Vidéos d’exécution (form guide)

Aide visuelle pour enchaîner le mouvement correctement.

## Convention

1. Fichier MP4 silencieux ou avec voix-off courte, idéalement 4–12 s, 720p ou 1080p, ratio 1:1 ou 9:16.
2. Nom = id canonique : `goblet_squat.mp4`, `back_squat.mp4`, …
3. Déclarer l’URL bundlée dans `src/utils/exerciseFormMedia.ts` (`FORM_VIDEO_BY_ID`).
4. Poster optionnel : réutiliser l’illustration wave1/wave2 via `resolvePickerIllustrationSrc`.

Tant qu’aucune entrée n’est déclarée, le guide affiche l’illustration 3D et un état « vidéo à venir ».
