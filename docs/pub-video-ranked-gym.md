# Pub vidéo Ranked Gym — 30 s et 15 s (9:16)

Vidéo de présentation commerciale, format vertical 1080×1920, 30 i/s, sans son (lisible en muet sur Reels, TikTok, Shorts, Google Ads vidéo). Tous les écrans sont les **vrais écrans de l'app** (nouvelle UX : accueil en galerie, nav en verre, tuiles colorées).

Fichiers générés : `marketing/pub-video/out/ranked-gym-pub-30s-9x16.mp4` et `ranked-gym-pub-15s-9x16.mp4`.

## Déroulé 30 s

| Temps | À l'écran | Message |
|-------|-----------|---------|
| 0 – 2,7 s | Mots qui défilent : MUSCU, COURSE, FOOT, BOXE, YOGA, NATATION, VÉLO, TENNIS + « +70 SPORTS » | Accroche multisport |
| 2,7 – 3,8 s | « TOUS TES SPORTS. / UNE SEULE APP. » | Promesse |
| 3,9 – 6,2 s | Logo panthère + « RANKED GYM » + « Entraîne-toi. Mange mieux. Progresse. » | Marque |
| 6,4 – 11,5 s | iPhone : l'accueil qui défile — « Ta séance du jour, prête quand tu l'es. » | Produit |
| 11,6 – 16,3 s | Écran Train + cartes Course à pied, Football, Yoga, Musculation — « Muscu, foot, yoga… Tout compte. » | Multisport |
| 16,4 – 21 s | Écran Nutrition (Scanner, Scan IA, repas) — « Calories et eau : suivi gratuit. » + « Scan code-barres & Scan IA · Pass Pro 6,99 €/mois » | Freemium |
| 21 – 26 s | Fond rouge, « 6 % » qui compte — « du chiffre d'affaires des abonnements reversé à des associations. » Lutte contre le cancer · Lutte contre la maladie · Personnes dans le besoin — « Tu progresses. Tu aides. » | Engagement solidaire |
| 26,2 – 30 s | Logo — « Sois en bonne santé. Construis le corps de tes rêves. » — bouton « Télécharge l'app gratuitement » — « Disponible maintenant • +70 sports • 6 % reversés » | Objectif + action |

La version 15 s garde : accroche → logo → accueil → 6 % → fin.

## Voix off (optionnelle, à enregistrer toi-même)

30 s, ton posé et motivant :

> Muscu, course, foot, yoga… Avec Ranked Gym, tous tes sports sont dans une seule app.
> Ta séance du jour t'attend. Tes calories et ton eau sont suivies gratuitement.
> Et 6 % de nos abonnements sont reversés à des associations qui luttent contre le cancer et la maladie.
> Sois en bonne santé. Construis le corps de tes rêves. Télécharge Ranked Gym.

## Musique

La vidéo est livrée sans musique (pas de droits sur un morceau). Dans CapCut ou InShot, ajoute une piste de la bibliothèque libre de droits : rythme électro / trap autour de 120–130 BPM, avec un temps fort à 2,7 s (« TOUS TES SPORTS ») et un passage plus doux à 21 s (le 6 %).

## Ce qui reste à me donner pour une version finale

- Le nom des associations partenaires (pour les afficher à la place de « Lutte contre le cancer… »).
- Le lien de téléchargement ou les stores où l'app est disponible (pour remplacer « Disponible maintenant »).

## Régénérer la vidéo

Après une modification de l'app ou du texte dans `marketing/pub-video/ad.html` :

```bash
node scripts/capture-pub-video.mjs   # vrais écrans + séquences de défilement, logo, police
node scripts/render-pub-video.mjs    # rend 30 s et 15 s dans marketing/pub-video/out/
node scripts/render-pub-video.mjs stills 30 9.5 24.5   # images fixes pour vérifier un moment précis
```

Prérequis : `ffmpeg` installé et Chrome (ou Chromium Playwright).
