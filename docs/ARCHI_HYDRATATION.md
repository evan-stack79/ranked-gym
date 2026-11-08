# ARCHI_HYDRATATION — Carte Eau & « Ma bouteille » (v0)

Auteur : Architecte Système  
Date : 8/11/2026  
Statut : **spécification** — pas de code app ; Dev seulement après brief Studio  
Réf. : `docs/SPEC_HYDRATATION.md` (HY-01…15, CA-HY1…12, §9 Vérificateur 8/11) · RK-03 · réponse Archi 14/10 (`SPEC_HYDRATATION.md` racine §8, reprise ici)  
Note : `SPEC_HYDRATATION.md` racine (PM, 14/10) est **remplacée** par `docs/SPEC_HYDRATATION.md` là où elles divergent (multi-bouteilles, contenants divers, refus visage = hors v0).

---

## 1. En bref

| Couche | Où | Rôle |
|--------|-----|------|
| Données eau (réglages + ajouts) | Convex `hydration*` | Source de vérité, même état Accueil + Alimentation (HY-14) |
| Calculs affichage | Client (fonctions pures) | Bu / restant / niveau dessin / message ≥ 3 L |
| Détourage bouteille | **Sur l’appareil** (WebView Capacitor) | Photo brute jamais envoyée (HY-08) |
| Image découpée + modèle | Stockage local appareil | Jamais sur le serveur |
| Rappels | Notifications **locales** | Opt-in, 3 max/j, jamais la nuit (HY-11) |

**Interdits** : lien rang / Force / Discipline / points RP (HY-07, RK-03) · récompense au-delà de l’objectif (HY-06) · autres boissons (HY-12) · objectif hors 1,0–3,0 L (C-HY2) · calcul selon le poids (C-HY1) · alerte de débit (C-HY3) · ajustement sport/chaleur calculé (C-HY5 = P1) · upload photo brute.

---

## 2. Valeurs figées (Vérificateur §9 — aucune autre formule)

| ID | Constante | Valeur | Usage |
|----|-----------|--------|-------|
| C-HY1 | `GOAL_DEFAULT_ML` | **1500** | Objectif par défaut, fixe, « eau bue seule » |
| C-HY2 | `GOAL_MIN_ML` / `GOAL_MAX_ML` | **1000 / 3000** | Bornes du curseur (réglage, pas limite santé) |
| C-HY2 | `GOAL_STEP_ML` | 100 | Choix UI (non scientifique) |
| C-HY3 | `HIGH_INFO_THRESHOLD_ML` | **3000** | Total jour ≥ 3000 → message doux §9, aucune félicitation |
| HY-15 | `GLASS_ML` | **250** | Mode verres |
| HY-01 | `CLASSIC_BOTTLE_ML` | **2000** | Mode 2 L |
| — | `CONTAINER_MIN_ML` / `MAX_ML` | 50 / 5000 | Choix de prudence Archi 14/10 (non sourcé), vérifié serveur |
| HY-11 | `REMINDERS_MAX_PER_DAY` | 3 | |
| HY-11 | `QUIET_START` / `QUIET_END` | 21:00 / 08:00 | Choix Product/Archi « jamais la nuit » — à GO Evan |

Ces constantes vivent dans **un seul module partagé** (`shared/hydration/constants.ts`) lu client + serveur. Pas de valeur en dur ailleurs.

**Calculs autorisés (seulement)** :
- `drunkMl = Σ amountMl` des ajouts non annulés du jour.
- `remainingMl = max(0, goalMl − drunkMl)`.
- `fillRatio = clamp(remainingMl / goalMl, 0, 1)` → niveau d’eau du dessin (le dessin se **vide**).
- `showHighInfo = drunkMl ≥ 3000`.
- Ajouts rapides (HY-02) : `+1 verre = 250` · `+½ bouteille = round(volumeMl / 2)` · `+bouteille = volumeMl` (volume = 2000 ou volume saisi Ma bouteille).

---

## 3. Modèle Convex (préfixe `hydration`)

`userId` = auth Convex existant. Aucune table `hydration*` n’est lue par `ranked*` / `rewards*` (garde §8).

### 3.1 `hydrationSettings` (1 ligne / user)

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id\<users\> | index unique `by_user` |
| `mode` | `"classic_2l" \| "glasses_250" \| "my_bottle"` | HY-01 |
| `goalMl` | number | 1000…3000, défaut 1500 |
| `myBottleVolumeMl` | number? | 50…5000 ; requis si `mode = my_bottle` (HY-10) |
| `myBottleHasShape` | boolean | true si une image découpée existe **sur un appareil** (info, pas l’image) |
| `remindersEnabled` | boolean | **false par défaut** (HY-11) |
| `reminderTimes` | string[] | `"HH:MM"` ; ≤ 3 ; toutes dans 08:00–21:00 |
| `onboardedAt` | number? | parcours premier lancement fait |
| `updatedAt` | number | |

### 3.2 `hydrationEntries` (ajouts, append + annulation logique)

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id | index `by_user_day` (`userId`, `dayKey`) |
| `dayKey` | string | `YYYY-MM-DD` **heure locale du téléphone** au moment de l’ajout |
| `amountMl` | number | entier, 1…5000 |
| `source` | `"glass" \| "half_bottle" \| "full_bottle" \| "slider"` | |
| `clientId` | string | UUID client — index unique `by_user_client` → idempotence hors-ligne |
| `createdAt` | number | serveur |
| `undoneAt` | number? | « annuler le dernier ajout » (HY-02) |

Pas de champ boisson : **eau seule** (HY-12) par construction.

### 3.3 Pas de table agrégat en v0
Historique 7 j = 7 `dayKey` × index `by_user_day` → somme côté query (volume faible). Agrégat `hydrationDaily` seulement si mesure de perf le justifie (P1).

---

## 4. Fonctions Convex

| Fonction | Type | Règles |
|----------|------|--------|
| `hydration.getToday({ dayKey })` | query | settings + `drunkMl` + `goalMl` + dernier ajout annulable. **Réactive** : Accueil et Alimentation l’abonnent → même chiffre partout sans code de synchro (HY-14, CA-HY9) |
| `hydration.getHistory({ endDayKey })` | query | 7 jours : `{ dayKey, drunkMl }` ; pas de note / statut réussi-raté (HY-05) |
| `hydration.addEntry({ clientId, dayKey, amountMl, source })` | mutation | valide `amountMl` 1…5000, `dayKey` format + écart ≤ 1 j vs date serveur ; idempotent sur `clientId` |
| `hydration.undoLast({ dayKey })` | mutation | met `undoneAt` sur le dernier ajout non annulé du jour |
| `hydration.updateSettings({ mode?, goalMl?, myBottleVolumeMl?, remindersEnabled?, reminderTimes? })` | mutation | bornes §2 rejetées serveur ; `mode = my_bottle` → **vérif entitlement Pro** (seul endroit) |
| `hydration.setBottleShapeFlag({ hasShape })` | mutation | info d’affichage multi-appareils |
| `hydration.deleteMyBottle()` | mutation | `myBottleHasShape = false`, `mode → classic_2l` ; le client efface l’image locale (HY-08) |

**Pro** : `my_bottle` est **cosmétique** (dessin). Si Pro expire → rendu dessin 2 L générique, **volume saisi et historique gardés**, ajouts toujours possibles (CA-HY12). Aucune autre fonction ne lit le plan.

**Hors-ligne** : ajout optimiste client (`useMutation` + optimistic update) + file locale des `clientId` non confirmés, rejouée à la reconnexion ; `dayKey` figé à l’ajout → bon jour même sans réseau.

---

## 5. Détourage « Ma bouteille » (HY-08, HY-09, HY-10)

### 5.1 Choix lib

| Plateforme | v0 retenu | Raison |
|-----------|-----------|--------|
| iOS (WKWebView Capacitor) | **Transformers.js** (Apache 2.0) + **BiRefNet-lite 512** (MIT), WebGPU si dispo sinon WASM | Un seul chemin de code pour les 3 plateformes ; licences commerciales OK ; déjà acté Archi 14/10 |
| Android (WebView) | idem | idem |
| Web | idem | idem |

- Modèle ~**98 Mo** (chiffre Archi 14/10, test publié tiers) : **téléchargé à la demande**, seulement à l’ouverture de « Ma bouteille » par un Pro, depuis **nos** fichiers statiques (pas un CDN tiers au runtime), avec message wifi avant (texte PM).  
- **Exclus** : `@imgly/background-removal` (AGPL) · RMBG BRIA (non commercial).  
- **P1 option** (pas v0) : plugins natifs (iOS Vision « foreground instance mask », Android ML Kit subject segmentation) pour éviter le téléchargement — licences / versions OS à vérifier avant.  
- Licences dans `LICENCES_TIERS.md`.

### 5.2 Pipeline sur l’appareil

1. Prise de vue guidée (`@capacitor/camera`, cadre pointillés + conseils, écran 3).  
2. Redimensionner ≤ 1024 px côté long, en mémoire.  
3. Inférence masque (worker Web pour ne pas geler l’UI).  
4. Composer PNG transparent recadré sur la bouteille.  
5. **Effacer la photo brute** (mémoire + fichier temporaire caméra) immédiatement.  
6. Écran Résultat : Valider / Refaire / **Recadrer à la main** (rectangle ajustable → masque manuel simple).  
7. Échec (exception, mémoire, masque vide/aberrant, téléchargement raté) → message + bouton **mode 2 L** ; jamais bloquant (HY-09, CA-HY8).  
8. Saisie volume 500 / 750 / 1000 / 1500 / autre (50…5000) (HY-10).

### 5.3 Stockage local

| Objet | Où | Si effacé par l’OS |
|-------|-----|--------------------|
| PNG découpé | `@capacitor/filesystem` `Directory.Data` (natif) · IndexedDB (web) | Dessin générique, volume gardé (serveur) |
| Modèle | Cache API / IndexedDB WebView, `navigator.storage.persist()` demandé | Re-téléchargé à la prochaine photo, sinon 2 L |
| Photo brute | **Nulle part** | — |

Serveur : **aucune image**. Nouveau téléphone = refaire la photo.  
Refus visage (MediaPipe, note 14/10) : **hors v0** (la photo ne quitte pas l’appareil) — à rouvrir si Product le redemande.

### 5.4 Dessin + animation
SVG/Canvas : silhouette (PNG découpé ou dessin 2 L / verre) + calque eau masqué par la silhouette, hauteur = `fillRatio`. Transition douce ; coupée si « Réduire les animations ». Couleurs neutres : pas de rouge / vert (HY-05).

---

## 6. Rappels (HY-11, CA-HY11)

- Lib : **`@capacitor/local-notifications`** (natif). Web : **pas de rappels v0**.  
- **Off par défaut** ; permission OS demandée **seulement** quand le joueur allume l’interrupteur.  
- Créneaux par défaut proposés : 10:00 · 14:00 · 18:00 (choix produit, modifiables), **max 3**, tous dans 08:00–21:00 ; refus serveur + client hors fenêtre.  
- Planification locale **répétée quotidienne** (ids fixes 7101–7103) ; re-planifier à chaque changement de réglage ; tout annuler si off ou permission refusée.  
- Pas d’envoi serveur (pas de push) en v0.  
- Texte neutre unique, sans chiffre de retard ni injonction (HY-05), ex. « Une gorgée d’eau ? » — wording final PM.  
- Option recommandée : ne pas re-planifier les rappels restants du jour une fois l’objectif atteint (moins de pression) — à GO Evan.

---

## 7. Écrans & composants client

| Composant | Où | Données |
|-----------|-----|---------|
| `WaterCard` (un seul composant) | Accueil **et** onglet Alimentation | `getToday` ; dessin + « 0,8 L restant » + « bu » + « +1 » ; libellé « Eau bue seule » (C-HY4) |
| `WaterModePicker` | Réglages Eau | 2 L · Verres (gratuits) · Ma bouteille (badge Pro → écran Pro, sans mention rang/points) |
| `BottleCaptureFlow` | Pro | §5 |
| `WaterGoalSlider` | Réglages Eau | 1,0–3,0 L, défaut 1,5 L |
| `WaterHistory7d` | Réglages Eau / détail carte | Barres, sans note ni couleur d’échec |
| `WaterReminders` | Réglages Eau | §6 |

Messages fixes (copie exacte Vérificateur §9) : message permanent (aliments/autres boissons) · message haut ≥ 3 L · message sport/chaleur · limites (grossesse, restriction médicale). Aucun autre texte santé.

---

## 8. Garde anti-P2W / isolation (HY-07, HY-13, RK-03)

- Modules `convex/hydration/*` n’importent **rien** de `ranked*` / `rewards*` et réciproquement (règle lint / test d’import).  
- Aucune écriture XP, Discipline, ledger RP depuis une mutation `hydration.*`.  
- Seul accès plan : `updateSettings` pour `mode = my_bottle`.  
- Test : user Pro vs free, mêmes ajouts → mêmes valeurs `getToday` / `getHistory` ; rang / points inchangés (CA-HY6, CA-HY12).

---

## 9. Lots Dev

| Lot | Contenu | Dépend |
|-----|---------|--------|
| **HY-a** | Constantes partagées + tables + `getToday` / `addEntry` / `undoLast` / `updateSettings` + `WaterCard` modes 2 L & verres sur Accueil + Alimentation + hors-ligne | GO Evan |
| **HY-b** | Curseur objectif 1–3 L, messages §9 (permanent, ≥ 3 L, sport), historique 7 j | HY-a |
| **HY-c** | Rappels locaux opt-in (iOS/Android) | HY-a |
| **HY-d** | Ma bouteille Pro : caméra guidée, téléchargement modèle, détourage worker, recadrage manuel, stockage local, fallback 2 L, Pro expiré | HY-a |
| **HY-e** | `LICENCES_TIERS.md`, tests isolation §8, tests CA-HY1…12 | HY-a…d |

HY-b / HY-c / HY-d parallélisables après HY-a.

---

## 10. Risques

| Risque | Mitigation |
|--------|------------|
| Mémoire / lenteur détourage sur vieux iPhone (WKWebView) | Image ≤ 1024 px, worker, timeout → fallback 2 L |
| WebGPU absent | WASM ; plus lent mais fonctionnel |
| Téléchargement 98 Mo (data mobile, échec) | À la demande, message wifi, reprise ; fallback 2 L |
| OS efface modèle / PNG | Re-téléchargement / dessin générique ; volume côté serveur |
| Double ajout hors-ligne | `clientId` idempotent |
| Changement de fuseau / minuit | `dayKey` figé client à l’ajout ; tolérance ±1 j serveur |
| Permission notif refusée | Interrupteur revient off + texte neutre |
| Fuite photo brute | Jamais de `upload` dans le flux ; test réseau (CA-HY7) |
| Glissement vers défi / P2W | Garde §8, pas de streak eau, pas de badge v0 |
| Mineurs | §9 Vérificateur = adultes 18+ ; s’appuie sur le contrôle d’âge existant de l’inscription |

---

## 11. Décisions Evan (figées 8/11/2026 — GO Studio Manager)

1. Fenêtre « jamais la nuit » = **21:00–08:00**.  
2. Créneaux par défaut **10:00 / 14:00 / 18:00**.  
3. **Stop rappels** du jour dès que l’objectif du jour est atteint.  
4. Photo bouteille (Ma bouteille) : **refuser si visage détecté** (v0) — complète §5.3 (qui disait hors v0).

Studio Manager porte le GO Evan.
