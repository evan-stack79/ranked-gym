# Licences tierces — Hydratation v2 + Ranked Pro Solo v0

| Composant | Licence | Usage v0 | Notes |
|-----------|---------|----------|-------|
| `@capgo/native-purchases` **8.9.6** | **MPL-2.0** | Achats StoreKit 2 / Play Billing | Tag vérifié : Billing Android **9.1.0** dans le Gradle du paquet. Capacitor ≥8 peer. MPL-2.0 : fournir les sources du composant couvert et de ses modifications ; n’impose pas l’ouverture des fichiers distincts de l’app (revue Juriste). |
| `@capacitor/local-notifications` | MIT | Rappels hydratation + rappel fin d’essai J−2 | Pas de push serveur |
| `@capacitor/core` | MIT | Déjà présent — détection plateforme native | |
| `@capacitor/status-bar` | MIT | Overlay status bar (mesh sous l’heure) | |
| `jose` | MIT | Vérification JWS Apple (ES256 / x5c) côté Convex | Pas de SaaS IAP |
| Shape Detection API `FaceDetector` | API navigateur | Refus visage photo Ma bouteille | Aucune lib si dispo |
| Transformers.js (`@huggingface/transformers`) | Apache-2.0 | **Prévu** détourage on-device (HY-d) | Non bundlé tant que `VITE_HYDRATION_CUTOUT≠1` |
| BiRefNet-lite 512 | MIT | **Prévu** modèle masque ~98 Mo | Téléchargé à la demande depuis nos statics ; pas de CDN tiers runtime |
| MediaPipe Face Detector (tasks-vision) | Apache-2.0 | **Optionnel** si FaceDetector API absente | Assets locaux `/models/` uniquement |

## Exclus volontairement
| Lib | Raison |
|-----|--------|
| `@imgly/background-removal` | AGPL — incompatible distribution app |
| RMBG BRIA | Licence non commerciale |
| `@revenuecat/purchases-capacitor` | SaaS IAP — hors choix Capgo + validation Convex directe |
| Stripe / lien paiement web | Interdit v0 (PRO-A03 / PRO-L09) |
| `cordova-plugin-purchase` | Non retenu (AB-a) |

## Capgo — notes AB-a
- `autoFinishTransactions: false` obligatoire ; finalisation après validation serveur.
- Ne jamais copier les exemples README qui activent un droit Pro côté client.
- Partage familial : désactivé côté serveur (`FAMILY_SHARING_DISABLED` si `FAMILY_SHARED`).

## Photo
Aucune photo brute n’est envoyée au serveur (HY-08). PNG découpé + flag `myBottleHasShape` seulement (image en local appareil).

## Assets contenants hydratation v2 (`public/assets/hydration/shell_*.png`)

| Asset | Source | Licence |
|-------|--------|---------|
| Bouteille 1,5 L / 50 cl | [Pexels — nerea arance](https://www.pexels.com/photo/water-bottle-with-blue-bottle-cap-11860563/) | [Pexels License](https://www.pexels.com/license/) |
| Verre 25 cl | [Pexels — Engin Akyurt](https://www.pexels.com/photo/a-clear-drinking-glass-10965758/) | Pexels License |
| Gourde (aperçu Pro) | [Unsplash](https://unsplash.com/photos/photo-1602143407151-7111542de6e8) | [Unsplash License](https://unsplash.com/license/) |

Détourage catalogue : `rembg` (local). Détourage « Ma bouteille » utilisateur : flood-fill on-device (pas de service payant).
