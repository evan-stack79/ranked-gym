# Sommeil — Science des 12 états (Ranked Gym)

**Date :** 15/11/2026 · **Auteur :** Vérificateur Scientifique · **Statut :** 9 états VALIDÉS, 3 états avec VETO partiel (3, 5, 9). Le VETO porte sur la règle « zéro mention d'un pro de santé ». Voir section D.
**Règles appliquées :** aucun point, boost ni contenu Pro lié au sommeil (RK-03). Aucun mot de diagnostic affiché (« insomnie », « hypersomnie », « apnée », « trouble »). Pas de message vers un médecin dans les textes (règle d'Evan), sauf la proposition minimale de la section D. Mineurs : pas de restriction du temps au lit, et aucune cible sous 8 h.
**Légende :** « choix produit (non publié) » = seuil choisi pour l'app, sans source publiée.

---

## A. Calculer et montrer les moyennes

**Données :** 7 nuits, avec l'heure de coucher, l'heure de lever, le ressenti (1 = « très mal », 5 = « très bien ») et l'âge.

**Attention :** « lever − coucher » donne le **temps au lit**, pas le temps de sommeil. L'agenda de sommeil de consensus sépare les deux, avec le temps pour s'endormir et les réveils (Carney 2012). Dans l'app, il faut écrire « Temps de nuit » ou « Nuit (au lit) », et non « sommeil réel ».

| Indicateur | Calcul | Affichage simple |
|---|---|---|
| Durée d'une nuit | `(lever − coucher) mod 1440` en minutes. Si le résultat est < 2 h ou > 16 h, demander « Tu confirmes ? » (choix produit (non publié)). | « 7 h 35 » |
| Durée moyenne 7 nuits | Moyenne des nuits valides, arrondie à 5 min : `round(m/5)×5` | « En moyenne : 7 h 35 par nuit » |
| Heure médiane de coucher / lever | **Décaler de 12 h :** `t' = (t − 720) mod 1440` (minutes depuis midi). Calculer la médiane sur t', puis revenir avec `t = (t' + 720) mod 1440`. Le lever peut se calculer sans décalage (minutes depuis minuit). | « Tu te couches vers 23 h 40 » |
| Régularité du coucher | Écart-type (n−1) sur t', en minutes, arrondi à 5 min. Variante robuste : écart-type circulaire `σ = √(−2 ln R̄) × 1440/2π`. | « Tes couchers varient d'environ 40 min » |
| Écart semaine / week-end (« social jetlag ») | Milieu du sommeil `MS = coucher + durée/2` (sur t'). `SJL = |médiane MS jours libres − médiane MS jours de cours/travail|` (Wittmann 2006). Par défaut, les jours libres sont les nuits du vendredi et du samedi. L'utilisateur peut les changer (choix produit (non publié)). | « Le week-end, ta nuit est décalée de 2 h 30 » |
| Écart de durée semaine / week-end | `Dwe − Dsem`, en moyennes | « +3 h le week-end » |
| Ressenti moyen | Moyenne des notes de 1 à 5, montrée en têtes de panthère arrondies à ½ tête | « 3,5 têtes sur 5 » |

**Pourquoi décaler de 12 h :** avec des couchers à 23 h 00 et 01 h 00, la moyenne naïve donne 12 h 00 (midi), ce qui est faux. Avec le décalage, on obtient 660 et 780 min, soit 720 min, donc **00 h 00**. C'est juste. La méthode est valable si tous les couchers tombent entre 12 h et 11 h 59 le lendemain. Hors de cette fenêtre, il faut le calcul circulaire.

**Minimum avant d'afficher :**
- moyennes affichées dès 3 nuits, avec la mention « provisoire » ;
- un **état** seulement à partir de **5 nuits valides sur 7** ;
- l'état 6 demande au moins 3 nuits de semaine et 1 nuit de week-end.

Tout cela est un choix produit (non publié). On montre la moyenne sur 7 nuits, jamais une note nuit par nuit.

**Besoin par âge (B_bas–B_haut)**, avec la plage « peut convenir » de la NSF :

| Âge | AASM | NSF (recommandé) | NSF « peut convenir » | Valeurs app |
|---|---|---|---|---|
| 13–17 | 8–10 h (13–18) | 8–10 h (14–17) | 7 h ou 11 h | 8–10 h |
| **18** | 8–10 h (13–18) | 7–9 h (18–25) | 6 h ou 10–11 h | **8–10 h** (valeur prudente ; **écart signalé**) |
| 19–25 | ≥ 7 h (adultes 18–60) | 7–9 h | 6 h ou 10–11 h | 7–9 h |
| 26–64 | ≥ 7 h (jusqu'à 60 ans) | 7–9 h | 6 h ou 10 h | 7–9 h |
| 65+ | — (le texte adulte couvre 18–60 ans) | 7–8 h | 5–6 h ou 9 h | 7–8 h |

On note `d = B_bas − D`, l'écart au repère bas en minutes. Si `d > 0`, la durée moyenne est sous le repère.

---

## B. Les 12 états (même gabarit)

Abréviations :
- D : durée moyenne ;
- Dsem / Dwe : durée moyenne en semaine / le week-end ;
- σC : écart-type du coucher ;
- Cmed : coucher médian ;
- R : ressenti moyen ;
- Q : question rapide en un tap.

Tous les seuils de l'algorithme sont des choix produit (non publiés), sauf mention d'une source.

### État 1 — « Nuits courtes et fatigué » (~6 h, épuisé, mal à s'endormir)
1. **Détection :** adultes `D < 6 h 30` (d > 30 min) ; 13–18 ans `D < 7 h 00` (d > 60 min) ; et `R ≤ 3`. **Q :** « Cette semaine, tu as souvent mis plus de 30 min à t'endormir ? » (Oui / Non). Le seuil de 30 min suit Ohayon 2017 (≤ 30 min = bon).
2. **Besoin :** 13–18 : 8–10 h · 18–25 : 7–9 h · 26–64 : 7–9 h · 65+ : 7–8 h.
3. **Actions :**
   - **Coucher cible qui avance de 15 min par jour** jusqu'à atteindre le repère. Le pas de 15 min est un choix produit (non publié). L'avance progressive est étudiée chez Crowley & Eastman 2015.
   - **Rappel « on ralentit »** 45 min avant le coucher cible : écrans en mode nuit ou posés, lumière douce (Chang 2015). Le délai de 45 min est un choix produit (non publié).
   - **Si Q = Oui :** « Pas de café, thé fort, soda au cola ni boisson énergisante dans les 6 h avant le coucher » (Drake 2013).
4. **Texte :** « Ta semaine a été chargée. On regagne du sommeil un petit pas à la fois : ce soir, coucher à 23 h 15. »
5. **Sources :** Hirshkowitz 2015 ; Paruthi 2016 ; Watson 2015 ; Ohayon 2017 ; Crowley & Eastman 2015 ; Chang 2015 ; Drake 2013.

**Statut : VALIDÉ.**

### État 2 — « Longues nuits, fatigue le matin ou le soir » (~11 h)
1. **Détection :** `D > B_haut` (13–18 et 18 ans : > 10 h ; 19–64 : > 9 h ; 65+ : > 8 h), `R ≥ 3`, et pas l'état 5. **Q :** « Tu es fatigué surtout au réveil, surtout le soir, ou toute la journée ? » Si la réponse est « toute la journée » avec `R ≤ 2`, on passe à l'état 5.
2. **Besoin :** voir le tableau A. La NSF accepte 10–11 h comme « peut convenir » pour les 18–25 ans, et dormir plus que le repère peut être associé à des effets négatifs (Paruthi 2016).
3. **Actions :**
   - **Lever fixe** (même heure tous les jours, ± 30 min ; choix produit (non publié)), avec un rappel au réveil (Phillips 2017 ; Windred 2024).
   - **Lumière du matin :** 30 min dehors ou près d'une fenêtre peu après le lever (Crowley & Eastman 2015 : 30 min de lumière vive le matin, en labo).
   - **Repère affiché :** « Ton repère : 8 à 10 h » (adapté à l'âge). On n'encourage pas à dormir encore plus.
4. **Texte :** « Tu dors beaucoup, c'est déjà une force. Pour te réveiller plus en forme, essaie le même réveil chaque jour. »
5. **Sources :** Hirshkowitz 2015 ; Paruthi 2016 ; Watson 2015 ; Phillips 2017 ; Windred 2024 ; Crowley & Eastman 2015.

**Statut : VALIDÉ.**

### État 3 — « Nuits très courtes mais en forme » (< 6 h, caféine ou adrénaline)
1. **Détection :** `D < 6 h 00` et `R ≥ 4`, sans sieste longue (sinon c'est l'état 10). **Q :** « Combien de cafés, thés, colas ou boissons énergisantes par jour ? » (0 / 1–2 / 3+), puis « Le dernier vers quelle heure ? ».
2. **Besoin :** < 6 h est en dessous de toutes les plages recommandées et « peut convenir » pour les moins de 65 ans (NSF). Pour les 65+, 5–6 h « peut convenir » (Hirshkowitz 2015). Les 13–18 ans sont à 2 h ou plus sous le repère (Paruthi 2016).
3. **Actions :**
   - **Caféine coupée 6 h avant le coucher.** Un rappel calcule l'heure limite (Drake 2013 : 400 mg pris 6 h avant le coucher réduisent quand même la nuit d'environ 41 min, effet proche de la significativité).
   - **Coucher cible qui avance de 15 min par jour** (choix produit (non publié)).
   - **Petit test « 3 jours » :** 3 nuits au repère, puis on compare le ressenti.
4. **Texte :** « Tu te sens en forme, top ! Ton corps a quand même besoin de plus de nuit. On teste 15 min de plus ce soir ? »
5. **Sources :** Hirshkowitz 2015 ; Paruthi 2016 ; Watson 2015 ; Drake 2013.

**Statut : VETO** (sur « zéro mention » ; voir D).

### État 4 — « Juste sous le besoin » (6 h 30–7 h, coups de barre l'après-midi), à partir de 19 ans
1. **Détection :** 19 ans et plus, `0 < d ≤ 30 min` (adultes : 6 h 30–6 h 59 ; 65+ : idem, repère 7 h) et (`R ≤ 3` ou Q = Oui). **Q :** « Coup de barre l'après-midi cette semaine ? » (Oui / Non).
2. **Besoin :** 19–25 et 26–64 : 7–9 h ; 65+ : 7–8 h (NSF). AASM : ≥ 7 h pour les 18–60 ans (Watson 2015).
3. **Actions :**
   - **Coucher cible 15 min plus tôt**, pendant 2 jours au maximum (+30 min au total ; choix produit (non publié)).
   - **Sieste flash optionnelle :** 10–20 min, avant 15 h. Brooks & Lack 2006 : la sieste de 10 min est la plus efficace ; à 30 min, on est engourdi au réveil. L'heure limite de 15 h est un choix produit (non publié) : dans l'étude, les siestes avaient lieu à 15 h.
   - **Caféine coupée 6 h avant le coucher** (Drake 2013).
4. **Texte :** « Il te manque juste un petit quart d'heure. 15 min de plus ce soir, et l'après-midi sera plus facile. »
5. **Sources :** Hirshkowitz 2015 ; Watson 2015 ; Brooks & Lack 2006 ; Drake 2013.

**Statut : VALIDÉ.**

### État 5 — « Très longues nuits et épuisé tout le temps » (10–12 h)
1. **Détection :** `D ≥ 10 h 00` (65+ : `D ≥ 9 h 00`) et `R ≤ 2` sur au moins 5 nuits valides. **Q :** « Tu es fatigué toute la journée, même après une longue nuit ? » (Oui / Non).
2. **Besoin :**
   - plus de 10 h est au-dessus du repère pour tous ;
   - la NSF ne juge pas recommandé plus de 11 h (14–25 ans), plus de 10 h (26–64 ans) ou plus de 9 h (65+) ;
   - dormir plus que le repère de façon régulière peut être associé à des effets négatifs (Paruthi 2016) ;
   - plus de 9 h peut convenir aux jeunes adultes, après un manque de sommeil ou en cas de maladie (Watson 2015).
3. **Actions :**
   - **Lever fixe** chaque jour (Phillips 2017 ; Windred 2024).
   - **Lumière du matin, 30 min** (Crowley & Eastman 2015).
   - **Garde-fou :** l'app ne conseille jamais de dormir plus. Elle ne propose pas non plus de réduire la nuit sous B_bas (pas sous 8 h pour un mineur).
4. **Texte :** « Tu dors beaucoup et tu restes fatigué : ce n'est pas de ta faute. On essaie un réveil à heure fixe et un peu de lumière le matin. »
5. **Sources :** Hirshkowitz 2015 ; Paruthi 2016 ; Watson 2015 ; Phillips 2017 ; Windred 2024.

**Statut : VETO** (sur « zéro mention » ; voir D).

### État 6 — « Yo-yo semaine / week-end » (5 h en semaine, 11 h 30 le week-end)
1. **Détection :** au moins 3 nuits de semaine et 1 nuit de week-end, `Dwe − Dsem ≥ 2 h` (ou `SJL ≥ 2 h`), et `Dsem < B_bas`. Le seuil de 2 h est un choix produit (non publié) : Wittmann 2006 décrit le phénomène sans fixer de seuil. **Q :** aucune nécessaire.
2. **Besoin :** on compare **Dsem** (pas D) au repère de l'âge (tableau A).
3. **Actions :**
   - **Coucher en semaine qui avance de 15 min par jour** (choix produit (non publié) ; avance progressive : Crowley & Eastman 2015).
   - **Grasse matinée limitée** à environ 1 h de plus que le lever en semaine, puis lumière du matin. Le chiffre de 1 h est un choix produit (non publié).
   - **Affichage dédié :** deux barres, semaine et week-end, plutôt qu'une seule moyenne trompeuse.
4. **Texte :** « Le week-end, tu rattrapes beaucoup. On rapproche tes deux rythmes, petit à petit. »
5. **Sources :** Wittmann 2006 ; Crowley & Eastman 2015 ; Hirshkowitz 2015 ; Paruthi 2016 ; AAP 2014.

**Statut : VALIDÉ.**

### État 7 — « Couche-tard régulier » (8 h, mais de 3 h à 11 h)
1. **Détection :** `Cmed` entre 01 h 30 et 06 h 00, `B_bas ≤ D ≤ B_haut`, `σC ≤ 90 min`, et pas l'état 6. La fenêtre 01 h 30–06 h 00 est un choix produit (non publié). **Q :** « Tes horaires de cours ou de travail t'obligent à te lever tôt certains jours ? » (Oui → surveiller l'état 6).
2. **Besoin :** durée OK pour l'âge. Les ados et jeunes adultes sont plus souvent du soir (Wittmann 2006 : effets les plus nets jusqu'à 25 ans).
3. **Actions :**
   - **Si l'utilisateur veut avancer ses horaires :** coucher et lever avancés de 15 min par jour (choix produit (non publié)), avec de la lumière dès le lever (Crowley & Eastman 2015). Ne pas reprendre la mélatonine de l'étude : c'est un médicament, hors app.
   - **Écrans réduits** dans l'heure avant le coucher (Chang 2015).
   - **Sinon :** on félicite la régularité, sans rien changer.
4. **Texte :** « Ton rythme est tardif mais régulier, et tu dors assez. Si tu veux te coucher plus tôt, on avance de 15 min par jour. »
5. **Sources :** Wittmann 2006 ; Crowley & Eastman 2015 ; Chang 2015.

**Statut : VALIDÉ.**

### État 8 — « Horaires en zigzag » (anarchiques chaque jour)
1. **Détection :** `σC > 90 min` ou écart-type du lever > 90 min, sur au moins 5 nuits. Le seuil de 90 min est un choix produit (non publié). L'état 12 exige < 45 min ; entre 45 et 90 min, aucun état « zigzag » n'est affiché, mais l'état 12 est exclu. **Q :** aucune.
2. **Besoin :** repère de l'âge (tableau A). Ici, la régularité est la priorité : elle prédit mieux le risque de mortalité que la durée (Windred 2024), et l'irrégularité est liée à de moins bons résultats scolaires (Phillips 2017).
3. **Actions :**
   - **Une seule ancre :** un lever fixe 7 jours sur 7 (± 30 min ; choix produit (non publié)).
   - **Rappel du soir à heure fixe :** « on ralentit ».
   - **Mini-routine de 3 gestes** au choix : douche, lecture papier, lumière douce.
4. **Texte :** « Tes horaires bougent beaucoup. Commence par un seul repère : te lever à la même heure chaque jour. »
5. **Sources :** Windred 2024 ; Phillips 2017 ; Chang 2015.

**Statut : VALIDÉ.**

### État 9 — « Nuit en morceaux » (8–9 h au lit, réveils, plus de 45 min pour s'endormir)
1. **Détection :** temps au lit `D` dans la plage de l'âge, et `R ≤ 2`, puis **Q** : « Cette semaine, combien de nuits tu as mis plus de 45 min à t'endormir, ou tu es resté réveillé longtemps la nuit ? » (0 / 1–2 / 3+). L'état est retenu si la réponse est « 3+ ». Le seuil de 3 nuits est un choix produit (non publié). Il ressemble au critère clinique « au moins 3 nuits par semaine » (VA/DoD 2025), qui n'est jamais affiché.
2. **Besoin :** temps d'endormissement de 0–30 min = bonne qualité ; 46–60 min = mauvaise (sauf personnes âgées) ; plus de 60 min = mauvaise à tout âge. Les réveils de plus de 5 min et le temps éveillé la nuit sont des indicateurs reconnus (Ohayon 2017).
3. **Actions :**
   - **« Le lit, c'est pour dormir » :** si tu ne dors pas, te lever et faire une activité calme dans la lumière douce, puis revenir quand le sommeil arrive. C'est inspiré du contrôle du stimulus (Edinger 2021, chez l'adulte). Pas de minutage imposé.
   - **Routine pour se détendre :** 5 min de respiration lente guidée (VA/DoD 2025, techniques de détente).
   - **Caféine coupée 6 h avant le coucher** (Drake 2013).
   - **Interdit dans l'app :** la restriction du temps au lit, pour tout le monde. C'est une méthode clinique encadrée (Edinger 2021 ; VA/DoD 2025 : à adapter en cas de forte somnolence).
4. **Texte :** « Tes nuits sont en petits morceaux. Ce soir, on essaie une routine calme de 5 min. »
5. **Sources :** Ohayon 2017 ; Edinger 2021 ; VA/DoD 2025 ; Drake 2013 ; Carney 2012.

**Statut : VETO** (sur « zéro mention » ; voir D).

### État 10 — « Nuit courte + grosse sieste » (5 h la nuit + 1 h 30–2 h en fin d'après-midi)
1. **Détection :** `D < 6 h 00`, puis **Q** : « Tu fais des siestes ? Combien de temps, et vers quelle heure ? ». L'état est retenu si la sieste dure au moins 60 min, au moins 3 jours sur 7, et commence après 15 h. Ces seuils sont un choix produit (non publié). Point de vigilance : la nuit seule sous-estime le total sur 24 h.
2. **Besoin :** repère de l'âge (tableau A). Selon la NSF, moins de siestes par 24 h va avec une meilleure qualité de sommeil, mais il n'y a pas de consensus sur les siestes (Ohayon 2017).
3. **Actions :**
   - **Sieste raccourcie à 20 min maximum, avant 15 h :** à 30 min, on est engourdi au réveil ; la sieste de 10 min est la plus efficace (Brooks & Lack 2006). L'heure de 15 h est un choix produit (non publié).
   - **Temps de sieste rendu à la nuit :** coucher qui avance de 15 min par jour (choix produit (non publié)).
   - **Rappel « sieste flash »** avec un minuteur de 20 min.
4. **Texte :** « Ta sieste t'aide, mais elle vole du sommeil à ta nuit. On la garde courte et tôt, et ta nuit grandit. »
5. **Sources :** Brooks & Lack 2006 ; Ohayon 2017 ; Hirshkowitz 2015.

**Statut : VALIDÉ.**

### État 11 — « Ado / jeune adulte un peu court » (7 h 30 à 16–20 ans)
1. **Détection :** 13–18 ans : `7 h 00 ≤ D < 8 h 00` (0 < d ≤ 60 min) ; 19–20 ans : même plage **et** `R ≤ 3`. **Q :** « Coup de barre en cours ou l'après-midi ? » (Oui / Non).
2. **Besoin et écart signalé :** AASM 13–18 : 8–10 h ; NSF 14–17 : 8–10 h ; NSF 18–25 : 7–9 h ; AAP 2014 : 8,5–9,5 h jugés optimaux pour les ados (source du « 8 h 30–9 h 30 » d'Evan). **Écart à 18–20 ans :** pour la NSF, 7 h 30 est **dans** la plage recommandée ; l'app ne doit donc pas dire « tu manques de sommeil » à un 19–20 ans en forme, d'où la condition `R ≤ 3`.
3. **Actions :**
   - **Coucher cible 15 min plus tôt** par jour, jusqu'à 8 h (mineurs : jamais de cible sous 8 h).
   - **Écrans posés** 30–60 min avant le coucher (Chang 2015 ; durée : choix produit (non publié)).
   - **Lever fixe**, y compris le week-end ± 1 h (choix produit (non publié)).
4. **Texte :** « À ton âge, le corps aime 8 à 10 h. Tu es tout près : 15 min de plus ce soir ! »
5. **Sources :** Paruthi 2016 ; Hirshkowitz 2015 ; AAP 2014 ; Chang 2015.

**Statut : VALIDÉ.**

### État 12 — « Rythme au top »
1. **Détection :**
   - `B_bas ≤ D ≤ B_haut` ;
   - `σC < 45 min` (seuil donné par Evan, choix produit (non publié)) ;
   - `Dwe − Dsem < 2 h` ;
   - `Cmed` avant 01 h 30 ;
   - `R ≥ 4`, sans aucune nuit à 1 ;
   - **Q :** aucune.
2. **Besoin :** repère de l'âge atteint (tableau A).
3. **Actions :**
   - **Garder la même ancre de lever.**
   - **Message de maintien** une fois par semaine au maximum.
   - Aucune récompense, aucun point (RK-03).
4. **Texte :** « Bravo, ton rythme est régulier et ta durée colle à ton âge. Continue comme ça ! »
5. **Sources :** Hirshkowitz 2015 ; Paruthi 2016 ; Watson 2015 ; Windred 2024.

**Statut : VALIDÉ.**

**Récapitulatif B :**

| État | Statut |
|---|---|
| 1 | VALIDÉ |
| 2 | VALIDÉ |
| 3 | **VETO** |
| 4 | VALIDÉ |
| 5 | **VETO** |
| 6 | VALIDÉ |
| 7 | VALIDÉ |
| 8 | VALIDÉ |
| 9 | **VETO** |
| 10 | VALIDÉ |
| 11 | VALIDÉ |
| 12 | VALIDÉ |

Si aucun état ne correspond (par exemple 6 h 00–6 h 29 chez un adulte ou 6 h 00–6 h 59 chez un 13–18 ans avec `R ≥ 4`, ou une longue nuit en forme), on n'affiche **aucun état** : seulement les moyennes, avec « Continue à noter tes nuits ».

---

## C. Ordre de priorité (un seul état affiché)

On évalue les règles dans cet ordre, et la première qui correspond gagne. L'ordre est un choix produit (non publié). La logique : traiter la **cause** avant le symptôme.

0. Moins de 5 nuits valides → aucun état.
1. **État 6** (yo-yo). Il passe avant 1, 3, 4 et 11, car la moyenne sur 7 nuits cache le manque de la semaine.
2. **État 8** (zigzag). L'irrégularité passe avant la durée.
3. **État 10** (sieste). Il passe avant 3 et 1, car la sieste explique le ressenti.
4. **État 9** (nuit en morceaux, si Q = « 3+ »).
5. **État 5** (très long + épuisé).
6. **État 3** (très court + en forme).
7. **État 1** (court + fatigué).
8. **État 7** (couche-tard, durée OK).
9. **État 11** (13–20 ans). Il remplace l'état 4 pour cet âge.
10. **État 4** (19 ans et plus).
11. **État 2** (long, fatigue partielle).
12. **État 12** (au top).
13. Aucun état.

**Contrôle des contradictions :**
- **États 1 et 3 :** séparés par le ressenti (`R ≤ 3` contre `R ≥ 4`).
- **États 4 et 11 :** séparés par l'âge (19 ans et plus contre 13–20 ans). Pour 19–20 ans, l'état 11 passe en premier.
- **État 1 chez les 13–18 ans :** il couvre `D < 7 h`, et l'état 11 couvre 7 h–7 h 59. Pas de recouvrement.
- **États 2 et 5 :** séparés par `R` et par Q.
- **État 7 et états 1, 3, 4 :** l'état 7 exige une durée OK.
- **États 7 et 8 :** séparés par σC (≤ 90 contre > 90 min).
- **État 12 et états 6, 7, 8 :** exclus par ses conditions.
- **Plafond de durée :** aucune action ne pousse au-delà de B_haut, et aucune ne fait viser sous 8 h un mineur.

---

## D. Point de sécurité — VETO du Vérificateur

**Ce que je dois dire honnêtement :** l'app ne voit que des heures et un ressenti. Elle ne peut pas voir ce qui se passe pendant la nuit. Les états **3**, **5** et **9**, ainsi que la **somnolence au volant ou en cours**, peuvent cacher un problème que seul un professionnel peut repérer.

**Ce que dit la littérature (vérifié) :**
- **AASM 2016 (communiqué sur les repères pédiatriques) :** les parents inquiets que leur enfant dorme trop peu ou trop doivent consulter un médecin. Dormir régulièrement plus que le repère peut être associé à des effets négatifs (Paruthi 2016).
- **Watson 2015 :** plus de 9 h de sommeil peut se voir chez les jeunes adultes, après un manque de sommeil, ou chez les personnes malades. Une très longue nuit peut donc être un signal (état 5).
- **VA/DoD 2025 :** les signes cliniques à repérer sont la somnolence, un ronflement fort et gênant, des arrêts de respiration vus par quelqu'un d'autre, et des étouffements la nuit. Citation : « If you are sleepy, you should neither drive nor perform dangerous or critical tasks. » La forte somnolence demande aussi d'adapter les méthodes comportementales.
- **Ohayon 2017 :** plus de 60 min pour s'endormir = mauvaise qualité de sommeil à tout âge (état 9).
- **État 3 :** moins de 6 h n'est jamais recommandé avant 65 ans (Hirshkowitz 2015). Se sentir « en forme » malgré tout n'est pas un signe fiable. C'est une prudence de ma part : je n'ai pas de chiffre publié vérifié sur ce point précis.

**Proposition minimale, compatible au maximum avec la règle d'Evan :**
- **Option A (recommandée) :** pas de push, pas de pop-up, pas de mot médical. Une seule ligne passive, en bas de la fiche d'aide des états 3, 5 et 9 : « Si la fatigue dure malgré tout, un pro de santé peut aider. » Elle n'est jamais montrée pour les 9 autres états.
- **Option B (plancher absolu, si Evan refuse A) :** zéro mention, mais dans les états 3, 5 et 9, l'app ne conseille jamais de dormir plus ou moins sans limite. Les actions restent dans `B_bas–B_haut` de l'âge, et la restriction du temps au lit est interdite partout.

**Statut :**
- **VETO** sur « zéro mention » pour les états 3, 5 et 9 (l'option B est le minimum non négociable) ;
- **VALIDÉ** pour les 9 autres états, sans aucune mention.

La somnolence au volant ou en cours n'est pas détectable avec les données actuelles. Si une question de ce type est ajoutée un jour, elle relève du même VETO.

---

## E. Sources (liens et mode de lecture)

| Source | Lien | Lecture |
|---|---|---|
| Paruthi S. et al. 2016, AASM pédiatrique, J Clin Sleep Med 12(6) | https://doi.org/10.5664/jcsm.5866 | Déjà vérifiée (brief) ; PMC en 403 aujourd'hui → contenu revu **via la recherche** |
| AASM 2016, communiqué « Recharge with sleep » (Paruthi) | https://aasm.org/recharge-with-sleep-pediatric-sleep-recommendations-promoting-optimal-health/ | **Lu directement** |
| Watson N.F. et al. 2015, AASM/SRS adultes, J Clin Sleep Med 11(6) | https://doi.org/10.5664/jcsm.4758 | Déjà vérifiée ; phrase sur plus de 9 h confirmée **via la recherche** |
| Hirshkowitz M. et al. 2015, NSF, Sleep Health 1(1) | https://doi.org/10.1016/j.sleh.2015.10.004 | Déjà vérifiée ; plages « peut convenir » **via la recherche** (PDF NSF bloqué) |
| Ohayon M. et al. 2017, NSF qualité du sommeil, Sleep Health 3(1):6-19 | https://doi.org/10.1016/j.sleh.2016.11.006 | **Via la recherche** (extraits du texte intégral) |
| Carney C.E. et al. 2012, Consensus Sleep Diary, Sleep 35(2):287-302 | https://doi.org/10.5665/sleep.1642 | **Via la recherche** |
| Windred D.P. et al. 2024, régularité et mortalité, Sleep 47(1):zsad253 | https://doi.org/10.1093/sleep/zsad253 | **Via la recherche** |
| Phillips A.J.K. et al. 2017, irrégularité et résultats scolaires, Sci Rep | https://www.nature.com/articles/s41598-017-03171-4 | **Via la recherche** |
| Wittmann M., Dinich J., Merrow M., Roenneberg T. 2006, Social jetlag, Chronobiol Int 23(1-2):497-509 | https://doi.org/10.1080/07420520500545979 | **Via la recherche** |
| Drake C. et al. 2013, caféine 0, 3 ou 6 h avant le coucher, J Clin Sleep Med 9(11):1195-1200 | https://doi.org/10.5664/jcsm.3170 | **Via la recherche** (extraits PMC) |
| Brooks A., Lack L. 2006, durée de sieste, Sleep 29(6):831-840 | https://doi.org/10.1093/sleep/29.6.831 | **Via la recherche** (résumé) |
| Crowley S.J., Eastman C.I. 2015, avance de phase par lumière du matin, Sleep Med | https://doi.org/10.1016/j.sleep.2014.12.004 | **Via la recherche** (résumé ; PubMed en 429) |
| Chang A.-M. et al. 2015, liseuses lumineuses le soir, PNAS 112(4) | https://doi.org/10.1073/pnas.1418490112 | **Via la recherche** |
| AAP 2014, School Start Times for Adolescents, Pediatrics 134(3):642 | https://doi.org/10.1542/peds.2014-1697 | **Via la recherche** |
| Edinger J.D. et al. 2021, guide AASM sur les approches comportementales, J Clin Sleep Med 17(2):255-262 | https://doi.org/10.5664/jcsm.8986 | **Via la recherche** (recommandations PMC) |
| VA/DoD 2025, insomnie chronique et apnée, résumé praticien v3.0 | https://healthquality.va.gov/HEALTHQUALITY/guidelines/CD/insomnia/I-OSA-CPG_2025-Provider-Summary_final_20250422.pdf | **Lu directement** |

**Pistes non utilisées (non vérifiées ici) :**
- Lovato & Lack 2010 ;
- NASA / Rosekind 1995 ;
- Roenneberg 2012 ;
- Burgess (lumière) ;
- validation Apple Watch (non nécessaire pour ce livrable).
