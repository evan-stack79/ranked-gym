# Hydratation — Science des 10 états (Ranked Gym)

**Date :** 15/11/2026 · **Auteur :** Vérificateur Scientifique · **Statut :** 7 états VALIDÉS ; 3 états avec VETO (2, 5, 7). Voir section D.
**Cohérence :** ce document respecte SPEC_HYDRATATION §9 (C-HY1 à C-HY5). Tout changement est marqué **PROPOSITION** ; aucune décision n'est modifiée en silence.
**Règles appliquées :**
- aucun point, boost ni récompense pour dépasser un objectif ; rien de Pro (RK-03) ;
- aucun mot médical affiché (« hyponatrémie », « déshydratation sévère », « diurétique ») ;
- aucun message qui renvoie vers un médecin, sauf l'option A de la section D ;
- ton jamais culpabilisant.

**Légende :** « choix produit (non publié) » = seuil choisi pour l'app, sans étude publiée.

---

## A. Calculer et montrer la journée et la semaine

**Données :** verres ou bouteilles saisis avec l'heure, type de boisson (si ajouté), séances de sport de l'app, âge, sexe, poids (si connu).

**1. Deux lignes, jamais mélangées.**
- **« Eau bue seule »** (C-HY4, inchangé) : somme des saisies de type eau. C'est la ligne principale, comparée à l'objectif réglé (C-HY1 : 1,5 L par défaut ; curseur de 1,0 à 3,0 L, C-HY2).
- **« Eau totale estimée »** (**PROPOSITION**, ligne secondaire, en petit) :
  - calcul : `toutes boissons saisies + aliments`, avec `aliments ≈ boissons × 0,25 à 0,43` ;
  - origine du coefficient : selon l'EFSA 2010, les aliments apportent 20–30 % de l'eau totale et les boissons 70–80 % ; donc 20/80 = 0,25 et 30/70 ≈ 0,43 (calcul, régime « moyen ») ;
  - affichage en fourchette : « environ 1,9 à 2,1 L » ;
  - libellé « estimation », jamais « besoins couverts » (C-HY4).

**2. Repères de contexte** (affichés comme « repère », jamais comme « besoin ») :

| Profil | Eau totale (aliments + boissons) | Part boissons (calcul 70–80 %) | Source |
|---|---|---|---|
| 4–8 ans (si l'app les accepte) | 1,6 L | 1,1–1,3 L | EFSA 2010 |
| 9–13 ans, garçons / filles | 2,1 L / 1,9 L | 1,5–1,7 L / 1,3–1,5 L | EFSA 2010 |
| 14 ans et plus, hommes / femmes | 2,5 L / 2,0 L | 1,75–2,0 L / 1,4–1,6 L | EFSA 2010 |
| 65 ans et plus, hommes / femmes | — | **au moins 2,0 L / 1,6 L de boissons proposées** | ESPEN 2019 |

**Conditions d'application :**
- **Température et activité :** ces valeurs supposent une température et une activité modérées (EFSA 2010).
- **Sport et chaleur :** pas de chiffre automatique en v0 (C-HY5) ; la sueur varie de 0,5 à 2,0 L/h selon la personne (ACSM 2007).
- **Poids :** il n'entre **pas** dans l'objectif d'eau (C-HY1). Il sert seulement au plafond de caféine des mineurs (état 7) et au calcul P1 de perte de poids pendant le sport (état 8).

**3. Répartition dans la journée.**
- **Journée app :** de 04 h 00 à 03 h 59 (choix produit (non publié)), pour qu'un verre bu à 00 h 30 compte dans la soirée.
- **4 tranches :** réveil–11 h, 11 h–15 h, 15 h–19 h, 19 h–coucher (choix produit (non publié)). Le coucher vient du module Sommeil s'il existe ; sinon 23 h.
- **Affichage :** 4 petites gouttes qui se remplissent. Aucune tranche n'est « ratée ». On ne voit que ce qui est bu.
- **Indicateur clé :** la part bue après 19 h, `V(19 h–coucher) / V(jour)`. Si l'heure de coucher est connue, on calcule aussi le volume des 2 dernières heures (EAU, état 6).

**4. Semaine.**
- **Jour « saisi » :** au moins 2 saisies (choix produit (non publié)).
- **Moyenne :** sur les seuls jours saisis, arrondie à 0,1 L. Elle est affichée avec « sur X jours notés ».
- **Médiane par tranche :** sur 7 jours.

**5. Minimums.**
- Un état s'affiche à partir de **4 jours saisis sur 7**, sauf les états 3 et 10, qui se basent sur l'absence de saisies (choix produit (non publié)).
- L'heure de saisie ne prouve pas l'heure où l'on a bu (C-HY3). Les règles horaires restent donc des **tendances**, jamais des alertes.

---

## B. Les 10 états (même gabarit)

Abréviations :
- V : eau bue seule par jour ;
- Vtot : toutes boissons ;
- J : nombre de jours saisis sur 7 ;
- Q : question rapide en un tap.

### État 1 — « Je bois peu pour ne pas avoir envie de faire pipi »
1. **Détection :**
   - `V < 1,0 L` sur au moins 3 jours (choix produit (non publié)), puis Q : « Tu bois moins pour éviter les toilettes (voiture, sortie, stress) ? » ;
   - l'état est retenu si la réponse est **Oui**.
2. **Repère :** C-HY1 (1,5 L, réglable) ; tableau A pour la part boissons.
3. **Actions :**
   - **Mode « je pars » :** un rappel pour boire **avant** de partir et à l'arrivée, plutôt que pendant le trajet.
   - **Petites gorgées régulières** plutôt qu'une grande quantité d'un coup.
   - **Fiche « eau qui se mange » :** fruits, légumes, soupes, laitages. Les aliments apportent 20–30 % de l'eau (EFSA 2010). Le lait fait produire moins d'urine que l'eau sur 4 h (Maughan 2016).
4. **Texte :** « Tu as le droit de vouloir être tranquille. Bois juste avant de partir : ton corps garde le reste pour plus tard. »
5. **Sources :** EFSA 2010 ; Maughan 2016.

**Statut : VALIDÉ.**

### État 2 — Personne âgée : « 2-3 verres suffisent, l'appli c'est du marketing »
1. **Détection :** 65 ans et plus (choix produit (non publié)), `V < 1,0 L` ou `Vtot < 1,6 L` sur au moins 4 jours, ou Q : « Tu as rarement soif ? » = Oui.
2. **Repère :** au moins 1,6 L (femmes) ou 2,0 L (hommes) de **toutes boissons** proposées par jour, sauf situation clinique qui demande autre chose (ESPEN 2019, recommandation R61).
3. **Ce qu'on peut dire honnêtement :**
   - la soif peut être moins forte avec l'âge, surtout quand il fait chaud, pendant le sport ou après avoir peu bu (Kenney & Chiu 2001) ;
   - mais les personnes âgées autonomes boivent en général assez au quotidien (même source) : ce n'est donc ni du marketing ni une alarme.
4. **Actions :**
   - compter **toutes les boissons** (thé, café, lait, soupe) dans `Vtot` ;
   - 3 rappels doux liés aux repas (choix produit (non publié)) ;
   - aucune hausse automatique de l'objectif.
5. **Texte :** « Avec l'âge, la soif prévient parfois moins bien. Ton café, ton thé et ta soupe comptent aussi ! »
6. **Sources :** ESPEN 2019 ; Kenney & Chiu 2001 ; EFSA 2010.

**Statut : VETO** (cœur et reins ; voir D).

### État 3 — « Je n'utilise pas le suivi »
1. **Détection :** 0 saisie sur 7 jours, ou module masqué. **Q :** aucune.
2. **Repère :** aucun affiché.
3. **Actions :**
   - **Zéro push**, zéro rappel, zéro badge.
   - Possibilité de **masquer** le module en un tap.
   - **Une seule carte discrète** dans l'app au maximum une fois par mois (choix produit (non publié)) : « Les aliments et les autres boissons apportent aussi de l'eau » (message permanent §9).
4. **Texte :** « Pas envie de compter ? Aucun souci. Le module reste là si un jour tu en as besoin. »
5. **Sources :** EFSA 2010 (aliments et boissons) ; RK-03.

**Statut : VALIDÉ.**

### État 4 — « Je ne veux plus boire sans compter »
1. **Détection :**
   - médiane d'au moins 12 saisies par jour sur 4 jours (choix produit (non publié)), puis Q : « Compter devient pesant ? » = Oui ;
   - ou l'utilisateur choisit « Faire une pause ».
2. **Repère :** aucun chiffre en mode pause. Message §9 : « L'objectif est un repère, pas un défi. »
3. **Actions :**
   - **Mode « sans compter » :** les chiffres sont masqués ; seulement 3 coches (matin, midi, soir).
   - **Pause de 7 jours** en un tap, rappels coupés.
   - **Retour progressif** proposé, jamais imposé.
4. **Texte :** « Ton corps sait aussi te guider. Tu peux faire une pause du comptage : rien n'est perdu. »
5. **Sources :** aucune étude vérifiée ici sur le suivi compulsif → choix produit (non publié). Hew-Butler 2015 (boire selon la soif chez l'adulte en effort).

**Statut : VALIDÉ.**

### État 5 — « Je bois beaucoup trop pour ne pas rater l'objectif »
1. **Détection :** `V ≥ 3,0 L` sur au moins 2 jours sur 7 (message C-HY3 déjà prévu dès 3,0 L ; nombre de jours : choix produit (non publié)), ou Q : « Tu bois même sans soif pour finir l'objectif ? » = Oui.
2. **Plafond (source exacte vérifiée) :**
   - l'IOM 2005 cite une excrétion maximale des reins de **0,7 à 1,0 L/h** ;
   - ce chiffre n'est **ni** un débit conseillé **ni** une garantie de sécurité, surtout pendant l'effort ;
   - le chiffre « 0,8–1,0 L/h » souvent cité n'a pas été retrouvé tel quel : l'IOM donne 0,7–1,0 L/h ;
   - aucun plafond quotidien officiel n'existe (IOM : pas de limite supérieure) ;
   - boire plus que ce qu'on perd est le mécanisme principal du problème lié à l'effort, et la soif aide à l'éviter (Hew-Butler 2015).
3. **Actions :**
   - **Objectif atteint :** rappels coupés et barre pleine, sans animation de « dépassement ».
   - **Message doux** dès 3,0 L, comme prévu en C-HY3.
   - **Si Q = Oui :** proposer de baisser l'objectif (curseur C-HY2) avec le message « boire selon ta soif ».
4. **Texte :** « Bravo, ton objectif est atteint ! Pour le reste de la journée, laisse ta soif décider. »
5. **Sources :** IOM 2005 ; Hew-Butler 2015 ; ACSM 2007.

**Statut : VETO** (voir D).

### État 6 — « Rattrapage du soir » (0,3 L avant 19 h, puis 1,5 L avant de dormir)
1. **Détection :** sur au moins 3 jours (choix produit (non publié)) :
   - `V(19 h–coucher) ≥ 1,0 L` **et** au moins 60 % du jour ;
   - ou au moins 0,5 L saisi dans les 2 h avant le coucher.

   Jours exclus : ceux avec une séance de sport de l'app après 17 h.
2. **Repère :** même total (C-HY1), mieux réparti. Le conseil grand public est de boire moins le soir, surtout dans les 2 h avant le coucher, pour moins se lever la nuit (EAU, fiche patients).
3. **Actions :**
   - **3 rappels de jour** (10 h, 13 h, 16 h ; choix produit (non publié)), coupés après 19 h.
   - **Repère visuel :** « moitié de la bouteille à 14 h » (choix produit (non publié)).
   - **Lien Sommeil :** si l'heure de coucher est connue, une goutte grise apparaît 2 h avant.
4. **Texte :** « Tu bois bien sur la journée ! En avançant un peu tes verres, tes nuits seront plus calmes. »
5. **Sources :** EAU (fiche patients) ; C-HY3 (l'heure de saisie n'est qu'une tendance).

**Statut : VALIDÉ.**

### État 7 — « Sodas, jus, boissons énergisantes ou 5 cafés : je suis hydraté ? »
1. **Détection :** types saisis, avec au moins 50 % de `Vtot` en boissons sucrées ou caféinées sur au moins 4 jours, ou au moins 5 boissons caféinées par jour (choix produit (non publié)).
2. **Réponse nuancée et sourcée :**
   - **Oui, ces boissons apportent de l'eau.** Après 1 L, le café, le thé, le cola et le jus d'orange ne font pas produire plus d'urine que l'eau (Maughan 2016). Chez des hommes habitués au café, 4 tasses de 200 mL par jour hydratent comme de l'eau (Killer 2014).
   - **Limites, sans jugement :**
     - adultes : caféine jusqu'à 400 mg/j et 200 mg par prise sans inquiétude (EFSA 2015) ;
     - mineurs : 3 mg/kg/j (EFSA 2015) ;
     - boissons énergisantes : environ 300–320 mg/L (EFSA 2015), soit environ 75–80 mg par canette de 25 cL (calcul) ;
     - sucres libres : moins de 10 % de l'énergie (OMS 2015).
3. **Actions :**
   - **Compter ces boissons dans `Vtot`**, mais pas dans « Eau bue seule » (C-HY4).
   - **Compteur de caféine du jour**, seulement si le type est saisi. Les valeurs par boisson restent à sourcer avant le code.
   - **Un échange par jour proposé**, par exemple un soda remplacé par une eau gazeuse au citron.
4. **Texte :** « Ces boissons comptent comme de l'eau. Tu veux en remplacer une par jour par de l'eau pétillante ? »
5. **Sources :** Maughan 2016 ; Killer 2014 ; EFSA 2015 ; OMS 2015.

**Statut : VETO** (mineurs ; voir D).

### État 8 — « Sportif sous-hydraté » (1 h 30 de muscu ou cardio à la chaleur sans ajuster)
1. **Détection :** séance de l'app d'au moins 60 min (choix produit (non publié)), et `V` du jour inférieur ou égal à la médiane des jours sans sport. **Q** après la séance : « Il faisait chaud ou tu as beaucoup transpiré ? ».
2. **Repère (ACSM 2007) :**
   - la sueur varie de 0,5 à 2,0 L/h selon la personne ;
   - but : éviter de perdre plus de 2 % du poids pendant l'effort ;
   - plan individuel conseillé ;
   - ne pas finir l'effort plus lourd qu'au départ : boire selon la soif (Hew-Butler 2015).
3. **Actions v0** (texte seulement, C-HY5) :
   - carte avant la séance : « Prends ta bouteille » ;
   - carte après : « Bois selon ta soif dans l'heure qui suit » ;
   - aucun ajout automatique à l'objectif.
4. **PROPOSITION P1 :** pesée avant et après la séance, puis calcul `perte % = (avant − après) / avant`. Un message neutre si la perte dépasse 2 % (ACSM 2007). Aucun conseil si le poids augmente, seulement « tu as déjà assez bu ».
5. **Texte :** « Grosse séance ! Ton corps a transpiré : écoute ta soif dans l'heure qui vient. »
6. **Sources :** ACSM 2007 ; Hew-Butler 2015 ; EFSA 2010.

**Statut : VALIDÉ.**

### État 9 — « Je n'aime pas l'eau plate »
1. **Détection :** Q à l'accueil ou au bout de 4 jours avec `V < 1,0 L` : « L'eau plate, ce n'est pas ton truc ? » = Oui.
2. **Repère :** C-HY1, et les aliments apportent 20–30 % de l'eau (EFSA 2010). L'eau gazeuse et le thé font produire autant d'urine que l'eau plate (Maughan 2016).
3. **Actions :**
   - **PROPOSITION de changement de C-HY4 :** compter l'eau gazeuse, les infusions sans sucre et l'eau aromatisée maison (fruits, menthe) dans « Eau bue seule », car c'est toujours de l'eau sans sucre.
   - **3 recettes simples** d'eau aromatisée maison.
   - **Fiche « eau qui se mange »**, sans proposer de boisson sucrée (OMS 2015).
4. **Texte :** « Pas fan de l'eau plate ? Pas de souci : eau pétillante, infusion ou eau au citron, ça compte ! »
5. **Sources :** EFSA 2010 ; Maughan 2016 ; OMS 2015.

**Statut : VALIDÉ** (la proposition C-HY4 reste à décider).

### État 10 — « J'abandonne au jour 4, trop de saisies »
1. **Détection :** au moins 6 saisies par jour (médiane) pendant les jours 1 à 3, puis 0 saisie pendant au moins 2 jours (choix produit (non publié)). Au-delà de 14 jours sans saisie, on passe à l'état 3.
2. **Repère :** inchangé (C-HY1).
3. **Actions :**
   - **Saisie en un tap :** « bouteille entière » (contenance enregistrée une fois), widget d'écran d'accueil, raccourci.
   - **Pas de série** ni de flamme perdue (RK-03).
   - **Un seul message de retour**, dans l'app et non en push : rater un jour ne casse pas une habitude (Lally 2010).
4. **Texte :** « Un jour sans noter, ce n'est rien. Une seule saisie par bouteille, et c'est réglé ! »
5. **Sources :** Lally 2010. L'effet des widgets ou de la friction n'a pas de source vérifiée ici → choix produit (non publié).

**Statut : VALIDÉ.**

**Récapitulatif B :**

| État | Statut |
|---|---|
| 1 | VALIDÉ |
| 2 | **VETO** |
| 3 | VALIDÉ |
| 4 | VALIDÉ |
| 5 | **VETO** |
| 6 | VALIDÉ |
| 7 | **VETO** |
| 8 | VALIDÉ |
| 9 | VALIDÉ |
| 10 | VALIDÉ |

---

## C. Ordre de priorité

Un seul état « semaine » est affiché. L'état 8 est une carte « du jour » qui peut s'ajouter. L'ordre est un choix produit (non publié) : la sécurité d'abord, puis la cause avant le symptôme.

0. Moins de 4 jours saisis → aucun état, sauf les états 3 et 10.
1. **État 5** (trop boire). Il bloque tout conseil « boire plus » des états 1, 2, 6 et 9.
2. **État 7, version mineur** (caféine au-dessus de 3 mg/kg/j).
3. **État 2** (65 ans et plus).
4. **État 6** (rattrapage du soir).
5. **État 1** (peur des toilettes).
6. **État 9** (pas l'eau plate).
7. **État 7, version adulte.**
8. **État 4** (pause du comptage).
9. **État 10** (abandon au jour 4).
10. **État 3** (aucune saisie).

**Contrôle des contradictions :**
- **États 1, 2, 9 et état 5 :** exclus par les volumes (`< 1,0 L` contre `≥ 3,0 L`) et par la priorité de l'état 5.
- **États 6 et 8 :** les jours avec une séance après 17 h sont retirés de l'état 6.
- **États 4 et 10 :** l'état 4 vient d'un choix de l'utilisateur ; l'état 10 est déduit des saisies.
- **États 10 et 3 :** passage de l'un à l'autre après 14 jours.
- **Plafond commun :** aucune action ne pousse au-delà de l'objectif réglé, ni au-delà de 3,0 L (C-HY2 et C-HY3).

---

## D. Point de sécurité — VETO du Vérificateur

**État 5 — trop boire.**
- **Le risque :** boire plus que ce qu'on perd est le mécanisme principal de la baisse du sel dans le sang liée à l'effort (Hew-Butler 2015). Les reins éliminent au maximum environ 0,7 à 1,0 L/h (IOM 2005), et ce n'est pas un débit sûr garanti. L'app ne voit pas les vraies heures où l'on boit (C-HY3).
- **Option A (recommandée) :** une ligne passive dans la fiche d'aide, sans push : « Boire bien plus que sa soif n'aide pas ; si tu te sens mal après avoir beaucoup bu, un pro de santé peut aider. »
- **Option B (plancher non négociable) :**
  - aucune mention ;
  - rappels coupés dès l'objectif atteint ;
  - aucune animation ni récompense au-delà ;
  - message C-HY3 à 3,0 L ;
  - curseur plafonné à 3,0 L (C-HY2) ;
  - jamais de « bois plus » quand l'état 5 est actif.
- **PROPOSITION P1** (pas en v0, pour respecter C-HY3) : une info douce si plus de 1,0 L est saisi en moins d'une heure, présentée comme « choix de prudence », pas comme un seuil médical.

**État 2 — personnes âgées avec une limite d'eau.**
- **Le risque :** l'ESPEN 2019 précise que des situations comme une maladie du cœur ou des reins peuvent demander de limiter l'eau. L'app ne peut pas le savoir.
- **Option A :** ligne passive « Si on t'a donné une limite pour boire, c'est elle qui compte. » Elle ne renvoie vers personne.
- **Option B :** aucune mention, aucune hausse automatique de l'objectif pour les 65 ans et plus, et aucun rappel au-delà de l'objectif réglé par l'utilisateur.
- **Conflit à signaler :** le §9 actuel contient « Si un médecin t'a donné une limite, suis-la » et une phrase grossesse qui cite « sage-femme ou médecin ». Ces deux phrases ne respectent pas la règle d'Evan. **PROPOSITION :** les reformuler comme dans l'option A.

**État 7 — caféine chez les mineurs.**
- **Le risque :** l'EFSA 2015 fixe 3 mg/kg/j pour les enfants et les ados. Une canette de 50 cL de boisson énergisante contient environ 150–160 mg (calcul à partir de 300–320 mg/L), soit la limite d'un ado de 50 kg.
- **Option A :** ligne passive dans la fiche : « Avant 18 ans, la caféine se limite à environ 3 mg par kilo par jour. »
- **Option B :** aucune mention, mais pour les mineurs, l'app ne propose jamais de boisson caféinée, ne les compte pas dans les suggestions, et le compteur de caféine reste visible si le type est saisi.

**Statut :**
- **VETO** sur « zéro garde-fou » pour les états 2, 5 et 7 (l'option B est le minimum) ;
- **VALIDÉ** sans mention pour les 7 autres.

**Incohérence à trancher :** le §9 dit « Adultes de 18 ans et plus uniquement / Mineurs exclus », alors que nos réponses suivantes (PR #142) acceptent les 9 ans et plus. L'âge minimum du module hydratation doit être fixé par écrit.

---

## E. Sources (liens et mode de lecture)

| Source | Lien | Lecture |
|---|---|---|
| EFSA 2010, valeurs de référence pour l'eau, EFSA J 8(3):1459 | https://doi.org/10.2903/j.efsa.2010.1459 | Déjà vérifiée le 8/11 **via la recherche** (ouverture directe expirée) |
| IOM / NASEM 2004-2005, DRI Water | https://www.nationalacademies.org/read/10925/chapter/6 | Déjà vérifiée ; excrétion de 0,7–1,0 L/h reconfirmée **via la recherche** |
| ANSES, eau en bouteille ou du robinet | https://www.anses.fr/fr/article/eau-bouteille-eau-du-robinet-bonnes-pratiques-consommation | Déjà vérifiée (8/11) |
| Sawka et al. 2007, ACSM Exercise and Fluid Replacement, MSSE 39(2) | https://doi.org/10.1249/mss.0b013e31802ca597 | **Via la recherche** (0,5–2,0 L/h ; plus de 2 %) |
| Hew-Butler et al. 2015, consensus EAH, Clin J Sport Med | https://journals.lww.com/cjsportsmed/fulltext/2015/07000/statement_of_the_third_international.2.aspx | **Via la recherche** |
| Volkert et al. 2019, ESPEN gériatrie, Clin Nutr 38:10-47 (et version pratique 2022) | https://www.espen.org/files/ESPEN-Guidelines/ESPEN_guideline_on_clincal_nutrition_and_hydration_in_geriatrics.pdf | **Via la recherche** (texte R61 cité dans la version pratique) |
| Kenney & Chiu 2001, âge, soif et apport en eau, MSSE 33(9):1524-1532 | https://doi.org/10.1097/00005768-200109000-00016 | **Via la recherche** (résumé et extraits) |
| Killer, Blannin & Jeukendrup 2014, café et hydratation, PLoS One 9(1):e84154 | https://doi.org/10.1371/journal.pone.0084154 | **Via la recherche** (résumé) |
| Maughan et al. 2016, Beverage Hydration Index, AJCN 103(3):717-723 | https://ajcn.nutrition.org/article/S0002-9165(22)06556-X/fulltext | **Via la recherche** (résumé) |
| EFSA 2015, sécurité de la caféine, EFSA J 13(5):4102 | https://doi.org/10.2903/j.efsa.2015.4102 | **Via la recherche** (résumé et page thématique EFSA) |
| OMS 2015, sucres chez l'adulte et l'enfant | https://www.who.int/publications/i/item/9789241549028 | **Via la recherche** |
| EAU, fiche patients « Self-management of nocturia » | https://patients.uroweb.org/condition/nocturia/treatment-options/self-management-of-nocturia-symptoms | **Lu directement** |
| Lally et al. 2010, formation des habitudes, Eur J Soc Psychol | https://doi.org/10.1002/ejsp.674 | **Via la recherche** (médiane de 66 jours, de 18 à 254 ; rater une fois ne change pas grand-chose) |

**Non confirmé ou non utilisé :**
- **« 0,8–1,0 L/h » :** non retrouvé tel quel ; corrigé en 0,7–1,0 L/h (IOM).
- **Caféine par tasse de café ou de thé :** non vérifiée, à sourcer avant le code.
- **Sources sur la friction de saisie et les widgets :** non trouvées.
- **Suivi compulsif :** aucune étude vérifiée.
- **DOI de Maughan 2016 et de Volkert 2019 :** non relevés ; les liens donnés sont les pages vérifiées.
