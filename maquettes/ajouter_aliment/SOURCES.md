# Sources — maquette « Ajouter un aliment »

Données récupérées le 9 octobre 2026 via l'API Open Food Facts (`https://world.openfoodfacts.org/api/v2/product/<code>`). Les réponses brutes sont dans `off_records/`.

- **Base de données** : © les contributeurs d'Open Food Facts, licence [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) ; contenus individuels sous [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).
- **Photos** : © les contributeurs d'Open Food Facts, licence [Creative Commons BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.fr). Les emballages peuvent contenir des marques déposées appartenant à leurs titulaires.
- **Attribution affichée dans la maquette** : « Données Open Food Facts » sous la liste, et « Photos : contributeurs Open Food Facts · CC BY-SA 3.0 ».

| # | Catégorie | Nom affiché (`product_name_fr`) | Portion affichée (`serving_size`) | Code-barres | Fiche OFF | Image d'origine (fichier local) | Note |
|---|---|---|---|---|---|---|---|
| 1 | Fruits | Myrtilles (brut : « myrtilles », seule la majuscule initiale ajoutée) | pour 100 g (serving_size absent dans OFF) | 20305819 | https://world.openfoodfacts.org/product/20305819 | https://images.openfoodfacts.org/images/products/000/002/030/5819/front_en.56.full.jpg (`photos/20305819.jpg`) |  |
| 2 | Laitages | Skyr | 1 portion (140 g) | 3033490004743 | https://world.openfoodfacts.org/product/3033490004743 | https://images.openfoodfacts.org/images/products/303/349/000/4743/front_fr.148.full.jpg (`photos/3033490004743.jpg`) |  |
| 3 | Repas | Ratatouille Cuisinée à la Provençal | 165 g | 3083680973939 | https://world.openfoodfacts.org/product/3083680973939 | https://images.openfoodfacts.org/images/products/308/368/097/3939/front_fr.110.full.jpg (`photos/3083680973939_recadre.jpg`) | Recadrée : 11,5 % retirés à gauche pour ne pas montrer le Nutri-Score imprimé sur la boîte (original : photos/3083680973939.jpg). |
| 4 | Boissons | BADOIT finement pétillante | 250 ml | 3068320114453 | https://world.openfoodfacts.org/product/3068320114453 | https://images.openfoodfacts.org/images/products/306/832/011/4453/front_de.106.full.jpg (`photos/3068320114453.jpg`) |  |
| 5 | Snacks | Prince | 20g | 7622210449283 | https://world.openfoodfacts.org/product/7622210449283 | https://images.openfoodfacts.org/images/products/762/221/044/9283/front_en.605.full.jpg (`photos/7622210449283.jpg`) |  |
| 6 | Laitages | PRESIDENT CAMEMBERT 250g | 30g | 3228021170039 | https://world.openfoodfacts.org/product/3228021170039 | https://images.openfoodfacts.org/images/products/322/802/117/0039/front_fr.182.full.jpg (`photos/3228021170039.jpg`) |  |

## Icônes

Icônes de catégories et d'interface : [Lucide](https://lucide.dev) v1.54.0 (`lucide-static`), licence ISC — fichiers dans `icons/`.

## Remarques

- Aucune calorie, aucun prix, aucun badge promo, aucun Nutri-Score n'est affiché par l'interface. Les photos sont des photos réelles d'emballages : certaines portent du texte imprimé (ex. « BLUEBERRIES », « 1L », « 250g »).
- Le produit Prince a pour marque `Mondelez Schweiz GmbH` dans OFF ; la marque n'est de toute façon pas affichée sur les cartes (nom + portion uniquement).

## Maquette v2 (rendus/v2_*.png)

Mêmes 6 produits, mêmes licences. Les photos v2 sont des **œuvres dérivées** (détourage) des photos OFF ci-dessus, donc toujours sous CC BY-SA 3.0, avec attribution aux contributeurs Open Food Facts. Fichiers dans `photos/detoure/`.

| Code-barres | Nom brut OFF | Nom affiché v2 (nettoyage éditorial) | Portion affichée (serving_size OFF) | Traitement photo |
|---|---|---|---|---|
| 20305819 | myrtilles | Myrtilles | pour 100 g (absent dans OFF) | photo recadrée en rond |
| 3033490004743 | Skyr | Skyr Danone (marque OFF : DANONE PRODUITS FRAIS FRANCE) | 1 portion (140 g) | fond retiré (rembg, modèle u2net) |
| 3083680973939 | Ratatouille Cuisinée à la Provençal | Ratatouille Cassegrain (marque OFF : Cassegrain) | 165 g | recadrage anti Nutri-Score + fond blanc retiré (remplissage) |
| 3068320114453 | BADOIT finement pétillante | Badoit finement pétillante | 250 ml | fond blanc retiré (remplissage) |
| 7622210449283 | Prince | Prince | 20 g (OFF : « 20g ») | fond retiré (rembg, isnet-general-use) |
| 3228021170039 | PRESIDENT CAMEMBERT 250g | Camembert Président (poids retiré du nom) | 30 g (OFF : « 30g ») | fond retiré (rembg, isnet-general-use) |

- Les noms n'ont été que réordonnés / remis en casse / débarrassés du poids, avec la marque OFF ajoutée quand utile. La portion vient toujours de `serving_size` (seule retouche : espace avant l'unité), jamais du nom.
- Outil de détourage : [rembg](https://github.com/danielgatis/rembg) (licence MIT), utilisé uniquement sur la box pour la maquette.

## Maquette v3 (rendus/v3_*.png)

Mêmes produits que la v2, sauf les myrtilles (20305819), **remplacées** par :

| # | Catégorie | Nom affiché (`product_name_fr` OFF, inchangé) | Portion affichée (`serving_size` OFF) | Code-barres | Fiche OFF | Image d'origine (fichier local) | Traitement |
|---|---|---|---|---|---|---|---|
| 7 | Fruits | Compote Pomme Nature (marque OFF : Andros) | 100 g (OFF : « 100g ») | 3608580789758 | https://world.openfoodfacts.org/product/3608580789758 | https://images.openfoodfacts.org/images/products/360/858/078/9758/front_fr.80.full.jpg (`photos/3608580789758.jpg`) | fond retiré (rembg, u2net) → `photos/detoure/3608580789758.png` |

- Licences identiques : photo © contributeurs Open Food Facts, CC BY-SA 3.0 (détourage = œuvre dérivée, même licence) ; données ODbL. Réponse API brute : `off_records/3608580789758.json`.
- L'emballage porte des mentions imprimées (« Sans Sucres Ajoutés », « 100 % Fruits ») : ce sont des inscriptions du fabricant sur la photo, pas des étiquettes de l'app.
- Noms v3 : identiques à la v2 pour les 5 autres produits (voir tableau v2).

### v3 — mise à jour 11:40 : compote remplacée par des bananes

La compote Andros (3608580789758) est **retirée** de la v3 (emballage avec « Sans Sucres Ajoutés » et « 100 % Fruits »). Ses fichiers restent dans le dossier mais ne sont plus utilisés. Remplacement :

| # | Catégorie | Nom affiché | Portion affichée | Code-barres | Fiche OFF | Image d'origine (fichier local) | Traitement |
|---|---|---|---|---|---|---|---|
| 8 | Fruits | Bananes Cavendish (OFF `product_name_fr` : « bananes Cavendish », majuscule initiale seulement ; marque OFF : Oaklands) | 1 portion (100 g) (OFF `serving_size` : « 1 serving (100 g) », « serving » traduit en « portion », valeur inchangée) | 20753030 | https://world.openfoodfacts.org/product/20753030 | https://images.openfoodfacts.org/images/products/000/002/075/3030/front_en.70.full.jpg (`photos/20753030.jpg`) | fond retiré (rembg, u2net) → `photos/detoure/20753030.png` |

- Photo : régime de bananes en vrac, aucun emballage. Seul texte visible : l'autocollant du producteur « Banano de Costa Rica · Del Monte Quality · #4186 » (origine, marque, code PLU), sans aucune allégation santé.
- Licences : photo © contributeurs Open Food Facts, CC BY-SA 3.0 (détourage = œuvre dérivée, même licence) ; données ODbL. Réponse API brute : `off_records/20753030.json`.

### Contrôle visuel des mentions imprimées sur les 5 autres emballages (v3)

| Produit | Mentions de type « mieux / santé » visibles sur la photo |
|---|---|
| Skyr Danone (3033490004743) | **Oui** : bandeau du bas « Nature, 0 % de matières grasses, onctueux et riche en protéines » (petit texte) |
| Ratatouille Cassegrain (3083680973939) | **Oui** : pastille « Sans additif » ; aussi « À l'huile d'olive vierge extra 1,5 % » (mention de recette) |
| Prince (7622210449283) | **Oui** : « au blé complet » ; logo « Charte Harmony » (programme blé du fabricant) |
| Badoit (3068320114453) | Non : « Source », « Saint-Galmier 1778 », « finement pétillante », « 1L » |
| Camembert Président (3228021170039) | Non : « Fabriqué en Normandie », « Poids net à l'emballage : 250 g » |

## v3 — version finale (mise à jour 11:43) : les 6 produits

Skyr Danone, Ratatouille Cassegrain et Prince sont **retirés** de la v3 (mentions « 0 % de matières grasses / riche en protéines », « Sans additif », « au blé complet » sur l'emballage). Leurs fichiers restent dans le dossier mais ne sont plus utilisés. Écartés aussi après contrôle visuel : LU Petit Beurre (calories imprimées), Emmental Entremont (étiquette prix « 3 for £3 »), Galbani Mozzarella (« N°1 in Italia »), Panzani Bolognaise (Nutri-Score), baguette Menissez (détourage impossible).

| # | Catégorie | Nom affiché (nom brut OFF) | Portion affichée (source) | Code-barres | Fiche OFF | Image d'origine (fichier local) | Traitement |
|---|---|---|---|---|---|---|---|
| 1 | Fruits | Bananes Cavendish (« bananes Cavendish ») | 1 portion (100 g) (OFF `serving_size` « 1 serving (100 g) ») | 20753030 | https://world.openfoodfacts.org/product/20753030 | https://images.openfoodfacts.org/images/products/000/002/075/3030/front_en.70.full.jpg (`photos/20753030.jpg`) | détourage rembg u2net |
| 2 | Laitages | Le Brie Président (« le Brie président ») | 0,5 pointe (100 g) (OFF `serving_size` « 0.5 wedge (100 g) » (« wedge » → « pointe », point décimal → virgule)) | 3228020232028 | https://world.openfoodfacts.org/product/3228020232028 | https://images.openfoodfacts.org/images/products/322/802/023/2028/front_en.114.full.jpg (`photos/3228020232028.jpg`) | détourage rembg u2net |
| 3 | Repas | Sardines Parmentier (« Conserverie Parmentier sardines ») | pour 100 g (`serving_size` absent dans OFF) | 3019081238698 | https://world.openfoodfacts.org/product/3019081238698 | https://images.openfoodfacts.org/images/products/301/908/123/8698/front_fr.63.full.jpg (`photos/3019081238698.jpg`) | haut recadré (4 %, boîtes voisines du rayon) + détourage rembg u2net |
| 4 | Boissons | Badoit finement pétillante (« BADOIT finement pétillante ») | 250 ml (OFF « 250 ml ») | 3068320114453 | https://world.openfoodfacts.org/product/3068320114453 | https://images.openfoodfacts.org/images/products/306/832/011/4453/front_de.106.full.jpg (`photos/3068320114453.jpg`) | fond blanc retiré (remplissage) |
| 5 | Snacks | Madeleine Bonne Maman (« Madeleine ») | 1 portion (100 g) (OFF `serving_size` « 1 serving (100 g) ») | 3178530407983 | https://world.openfoodfacts.org/product/3178530407983 | https://images.openfoodfacts.org/images/products/317/853/040/7983/front_en.21.full.jpg (`photos/3178530407983.jpg`) | détourage rembg u2net : ne garde que la photo des madeleines imprimée sur le sachet (le sachet et son texte sont retirés) |
| 6 | Laitages | Camembert Président (« PRESIDENT CAMEMBERT 250g ») | 30 g (OFF « 30g ») | 3228021170039 | https://world.openfoodfacts.org/product/3228021170039 | https://images.openfoodfacts.org/images/products/322/802/117/0039/front_fr.182.full.jpg (`photos/3228021170039.jpg`) | détourage rembg isnet-general-use |

Licences : photos © contributeurs Open Food Facts, CC BY-SA 3.0 (les détourages sont des œuvres dérivées, même licence) ; données ODbL. Réponses API brutes dans `off_records/`. Noms : uniquement casse, ordre des mots et marque OFF ajoutée ; poids retiré du nom du camembert.

### Contrôle visuel final des mentions imprimées (v3, 6 produits)

| Produit | Texte visible sur la photo affichée | Allégation santé / « mieux » ? |
|---|---|---|
| Bananes Cavendish | autocollant « Banano de Costa Rica · Del Monte Quality · #4186 » | Non |
| Le Brie Président | « Texture crémeuse », « le Brie », « Président », « Produit en France », « Suggestion de présentation » | Non |
| Sardines Parmentier | « Conserverie Parmentier », « Savoir-faire depuis 1883 », « Sardines », « Huile de tournesol » | Non |
| Badoit finement pétillante | « Source », « Saint-Galmier 1778 », « Badoit », « finement pétillante », « 1L » | Non |
| Madeleine Bonne Maman | aucun (seules les madeleines sont gardées ; le sachet porte « Bonne Maman », « Madeleine », « Traditional French Sponge Cake ») | Non |
| Camembert Président | « Camembert », « Président », « Fabriqué en Normandie », « Poids net à l'emballage : 250 g » | Non |

Aucun Nutri-Score, prix, promo ni calories visibles sur les 6 photos affichées.
