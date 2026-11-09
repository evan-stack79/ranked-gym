# Licences tierces — Hydratation v0 (HY-e)

| Composant | Licence | Usage v0 | Notes |
|-----------|---------|----------|-------|
| `@capacitor/local-notifications` | MIT | Rappels locaux opt-in (iOS/Android) | Pas de push serveur |
| `@capacitor/core` | MIT | Déjà présent — détection plateforme native | |
| Shape Detection API `FaceDetector` | API navigateur | Refus visage photo Ma bouteille | Aucune lib si dispo |
| Transformers.js (`@huggingface/transformers`) | Apache-2.0 | **Prévu** détourage on-device (HY-d) | Non bundlé tant que `VITE_HYDRATION_CUTOUT≠1` |
| BiRefNet-lite 512 | MIT | **Prévu** modèle masque ~98 Mo | Téléchargé à la demande depuis nos statics ; pas de CDN tiers runtime |
| MediaPipe Face Detector (tasks-vision) | Apache-2.0 | **Optionnel** si FaceDetector API absente | Assets locaux `/models/` uniquement |

## Exclus volontairement
| Lib | Raison |
|-----|--------|
| `@imgly/background-removal` | AGPL — incompatible distribution app |
| RMBG BRIA | Licence non commerciale |

## Photo
Aucune photo brute n’est envoyée au serveur (HY-08). PNG découpé + flag `myBottleHasShape` seulement (image en local appareil).

## Assets contenants hydratation v2 (`public/assets/hydration/shell_*.png`)

| Asset | Source | Licence |
|-------|--------|---------|
| Bouteille 1,5 L / 50 cl | [Pexels — nerea arance](https://www.pexels.com/photo/water-bottle-with-blue-bottle-cap-11860563/) | [Pexels License](https://www.pexels.com/license/) |
| Verre 25 cl | [Pexels — Engin Akyurt](https://www.pexels.com/photo/a-clear-drinking-glass-10965758/) | Pexels License |
| Gourde (aperçu Pro) | [Unsplash](https://unsplash.com/photos/photo-1602143407151-7111542de6e8) | [Unsplash License](https://unsplash.com/license/) |

Détourage catalogue : `rembg` (local). Détourage « Ma bouteille » utilisateur : flood-fill on-device (pas de service payant).
