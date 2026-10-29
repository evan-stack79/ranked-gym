# Matrice de Validation Scientifique — Ranked Force / Ranked Discipline (P0)

Date : 29/10/2026  
Auteur : Vérificateur Scientifique  
Réf. Product : `/workspace/ranked_gym/docs/SPEC_RANKED.md`  
Mouvements P0 (Marketing) : squat, bench (développé couché), deadlift (soulevé de terre), row barre, OHP (développé militaire)  
Charte : performance only · 18+ · jamais classer l’apparence · jamais afficher le poids corporel · classement absolu par défaut  

**Synthèse** : 5 VALIDÉ · 1 SOFT VETO (plafonds row/OHP absolus chiffrés) · 0 VETO dur. Soft veto = alternative proposée, pas un blocage du P0.

---

## RF-1RM-01 — Estimation du 1RM (Epley)

| Champ | Contenu |
|---|---|
| **Statut** | **VALIDÉ** |
| **Formule exacte** | `1RM = w × (1 + r/30)` avec w = charge (kg), r = répétitions complètes (entier). Équivalent : `w × (1 + 0,0333 × r)`. |
| **Usage Ranked** | Pour r = 1 : 1RM = w (charge réelle). Pour 2 ≤ r ≤ 10 : 1RM estimé. Pour r > 10 : **hors score Ranked Force** (carnet OK). |
| **Source** | LeSuer DA et al. (1997). *The Accuracy of Prediction Equations for Estimating 1-RM Performance in the Bench Press, Squat, and Deadlift.* J Strength Cond Res. 11(4):211–213. PDF : https://paulogentil.com/pdf/The%20Accuracy%20of%20Prediction%20Equations%20for%20Estimating%201-RM%20Performance%20in%20the%20Bench%20Press,%20Squat,%20and%20Deadlift.pdf · Abstract NSCA : https://journals.lww.com/nsca-jscr/abstract/1997/11000/the_accuracy_of_prediction_equations_for.1.aspx |
| **Source complémentaire** | Reynolds JM, Gordon TJ, Robergs RA (2006). *Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry.* J Strength Cond Res. 20(3):584–592. PubMed : https://pubmed.ncbi.nlm.nih.gov/16937972/ |
| **Population** | LeSuer : 67 étudiants (40 H, 27 F), non entraînés, reps ≤ 10, bench / squat / deadlift. Reynolds : 70 adultes 18–69 ans (34 H, 36 F), bench + leg press. |
| **Marge d’erreur** | Corrélations élevées (r > 0,95) pour ≤ 10 reps. Les formules **sous-estiment** souvent le vrai 1RM ; deadlift le moins précis (~9–14 % de sous-estimation dans LeSuer). Afficher clairement « **1RM estimé** ». |
| **Alternatives** | Brzycki, Mayhew, Wathan, Lander, Lombardi, O’Conner (mêmes études). Aucun vainqueur statistique clair pour 2–10 reps. **Epley retenu** car simple, public, et dans le set validé. |
| **Limites** | Pas de validation solide pour **row barre** ni **OHP** → même formule autorisée pour le classement interne, avec mention « estimation non validée pour ce mouvement ». Non validé < 18 ans (déjà exclus Ranked). Grossesse / allaitement : pas de Ranked compétitif. Peu de données > 69 ans. |
| **Seuil sécurité** | Ne jamais présenter l’estimation comme un record médical ou une promesse de perf. |

---

## RF-CAP-01 — Plafonds physio anti-triche (absolu)

| Champ | Contenu |
|---|---|
| **Statut** | **VALIDÉ** pour squat / bench / deadlift · **SOFT VETO** pour un plafond absolu chiffré row / OHP (pas de record fédéré standard) |
| **Principe** | Classement **absolu** (kg). **Ne jamais afficher le poids corporel.** Les plafonds anti-triche sont des plafonds absolus (record du monde observé + marge). |
| **Source données** | Archive OpenPowerlifting (domaine public), export `openpowerlifting-2026-10-24` : https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html · Licence/README dans l’archive. Site : https://www.openpowerlifting.org/ |
| **Records raw (toutes fédérations, Best3, Sex M/F) — max observés dans l’export** | |

| Mouvement | Hommes (raw) | Femmes (raw) | Athlète / date / fédé (export) |
|---|---|---|---|
| Squat | **490,5 kg** | **321,5 kg** | Devonte Lewis #1, 2026-06-12, USAPL / Sonita Muluh, 2026-06-13, IPF |
| Bench | **355,0 kg** | **207,5 kg** | Julius Maddox, 2021-02-20, WRPF / April Mathis, 2016-12-03, SPF |
| Deadlift | **492,5 kg** | **297,5 kg** | Colton Engelbrecht, 2026-07-11, WRPF / Samantha Rice, 2025-12-06, RPS |

**Plafonds P0 proposés (refus auto Ranked Force si 1RM estimé > plafond)** — marge ~5 % au-dessus du max observé, arrondi :

| Mouvement | Plafond H | Plafond F | Note |
|---|---|---|---|
| Squat | **515 kg** | **340 kg** | |
| Bench | **375 kg** | **220 kg** | |
| Deadlift | **520 kg** | **315 kg** | |
| Row barre | — | — | SOFT VETO chiffre absolu |
| OHP | — | — | SOFT VETO chiffre absolu |

**Si sexe non déclaré** : appliquer le plafond **H** (plus haut) pour éviter les faux positifs ; le badge Vérifié + anomalies restent.  
**Jamais** exiger le poids corporel pour Ranked Force P0.

**SOFT VETO row / OHP — alternative VALIDÉE** :
1. Plafond **relatif** (sans poids corporel) : `row_1RM_estimé ≤ deadlift_1RM_vérifié` ; `OHP_1RM_estimé ≤ bench_1RM_vérifié` (si le 1RM de référence n’existe pas encore → pas de Ranked Force sur ce mouvement jusqu’à preuve).
2. Au-dessus de seuils produits provisoires (ex. row > 250 kg ou OHP > 180 kg) → **file de relecture / vidéo**, pas un chiffre « record monde » inventé.
3. Avant prod : option de recalibrer après 3 mois de logs anonymisés.

| Champ | Contenu |
|---|---|
| **Limites** | Records multi-fédés (pas tous testés IPF). Équipés / strongman exclus de ces plafonds raw. Avant mise en ligne : retélécharger un export OPL frais et ajuster si un record dépasse. |
| **Population** | Athlètes de compétition adultes ; pas des utilisateurs gym moyens. |

---

## RF-ANOM-01 — Seuils d’anomalie (sauts de charge)

| Champ | Contenu |
|---|---|
| **Statut** | **SOFT VETO** sur un seuil « impossible » unique **publié** · **VALIDÉ** le cadre ACSM + drapeau produit |
| **Source** | American College of Sports Medicine (2009). *Progression Models in Resistance Training for Healthy Adults.* Med Sci Sports Exerc. 41(3):687–708. PubMed : https://pubmed.ncbi.nlm.nih.gov/19204579/ · DOI : https://doi.org/10.1249/MSS.0b013e3181915670 |
| **Fait sourcé** | Quand on peut faire 1–2 reps de plus que la cible, augmenter la charge de **2–10 %** (petits muscles → bas de fourchette). |
| **Ce qui n’existe pas** | Aucune étude peer-reviewed trouvée qui fixe « +X % 1RM en une séance = fraude ». |
| **Règles P0 proposées (drapeau, pas ban auto)** | |
| A | `Δ 1RM estimé > 15 %` sur le **même mouvement** en ≤ 7 jours → drapeau « anomalie » + double confirmation / relecture. |
| B | `Δ 1RM estimé > 25 %` en ≤ 7 jours → refus Ranked Force jusqu’à relecture humaine (carnet déclaré continue). |
| C | Historique < 8 semaines : tolérance **A** relevée à 25 % / **B** à 40 % (gains débutants plus rapides — cohérent ACSM novice). |
| D | Dépassement plafond RF-CAP-01 → refus, indépendamment de A/B. |
| **Limites** | Drapeaux = heuristiques produit ancrées ACSM, pas des constantes physiologiques universelles. |

---

## RF-DISC-01 — Ranked Discipline (séances / semaine + streak)

| Champ | Contenu |
|---|---|
| **Statut** | **VALIDÉ** avec garde-fous anti-surentraînement |
| **Formule / mesure** | (1) Nombre de **séances terminées** sur 7 jours glissants. (2) Streak = semaines consécutives avec ≥ **N** séances (N = 2 ou 3, choix produit). **Pas** de score de récupération, sommeil, look, âge biologique. |
| **Source fréquence** | ACSM 2009 (même position stand) : novice **2–3** j/sem ; intermédiaire **3–4** ; avancé **4–5** (jusqu’à split plus fréquent). |
| **Source surentraînement** | Meeusen R et al. (2013). *Prevention, diagnosis and treatment of the overtraining syndrome…* Joint consensus ECSS / ACSM. PubMed : https://pubmed.ncbi.nlm.nih.gov/23247672/ — déséquilibre charge / récupération = facteur clé. |
| **Cible SPEC (3–5/sem)** | **OK santé** pour adultes entraînés, alignée ACSM. |
| **Garde-fous obligatoires** | |
| 1 | **Plafonner les points Discipline à 5 séances / 7 jours** : 6e et 7e séances n’ajoutent **aucun** point Ranked (évite d’encourager l’entraînement quotidien extrême). |
| 2 | Streak basée sur **semaines régulières**, pas « jours d’affilée sans repos ». Un jour de repos **ne casse pas** le streak. |
| 3 | Bouton / statut **pause blessure ou maladie** : gèle streak et Discipline sans pénalité. |
| 4 | Texte UI : le repos fait partie de la progression ; douleur / blessure → arrêter et voir un pro. |
| **Limites** | 18+ seulement pour Ranked compétitif. Grossesse / allaitement : pas de Discipline compétitive (aligné règles app calories). |
| **Seuil sécurité** | Jamais de défi type « 7 jours / 7 » comme condition de rang. |

---

## RF-RESET-01 — Soft reset / ligues (~6–8 semaines)

| Champ | Contenu |
|---|---|
| **Statut** | **VALIDÉ** |
| **Principe** | Cycle compétitif 6–8 semaines + soft reset (re-placement), pas un rang figé forever (SPEC). |
| **Sources** | ACSM 2009 : périodisation recommandée intermédiaire / avancé. Bell L et al. (2023). Delphi sur les décharges : souvent toutes les **4–6 semaines**, ~7 jours, surtout baisse de volume. PMC : https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/ |
| **Garde-fous** | |
| 1 | Soft reset = **re-placement partiel**, jamais remise à zéro totale des PR vérifiés du carnet. |
| 2 | Prévoir / ne pas pénaliser une **semaine plus légère** en fin de cycle (aligné décharge). |
| 3 | Ligues basées sur **PR vérifiés** (Force) et **régularité plafonnée** (Discipline) — **pas** sur volume total kg / défis « raid 10k kg » sans cadre. |
| 4 | Aucun bonus Ranked pour volume extrême quotidien. |
| **Limites** | Durée 6–8 sem = choix produit compatible mésocycle, pas une constante médicale. |

---

## Pondération des 5 mouvements (principe)

| Champ | Contenu |
|---|---|
| **Statut** | **VALIDÉ principe** (chiffres de poids = produit) |
| **Principe** | Score Force = agrégat des 1RM estimés **vérifiés** sur les 5 mouvements. Pondération égale P0 acceptable ; ou pondération publiée (ex. squat/bench/deadlift un peu plus). |
| **Contrainte** | Row / OHP : même formule Epley + plafond relatif RF-CAP-01 jusqu’à calibrage. |
| **Source** | Pas de méta-analyse imposant des poids relatifs pour un classement gym social → libre produit **si** méthode publique (SPEC RK barème public). |

---

## Tableau récapitulatif

| ID | Élément | Statut |
|---|---|---|
| RF-1RM-01 | Epley 1RM, reps 1–10 | **VALIDÉ** |
| RF-CAP-01 | Plafonds squat/bench/deadlift absolus | **VALIDÉ** |
| RF-CAP-01b | Plafonds absolus row / OHP | **SOFT VETO** → relatif + relecture |
| RF-ANOM-01 | Sauts % séance | **SOFT VETO** chiffre unique → drapeaux A/B/C VALIDÉS |
| RF-DISC-01 | Discipline séances/streak | **VALIDÉ** (+ plafond 5/sem) |
| RF-RESET-01 | Soft reset 6–8 sem | **VALIDÉ** |
| — | Apparence / look / âge bio / readiness | **VETO** (hors charte + hors sources Ranked Force) |

---

## Vetos éventuels (liste courte)

1. **SOFT VETO** : plafond absolu « record » pour row barre et OHP — **alternative** : plafond relatif + file vidéo.  
2. **SOFT VETO** : un seul % « impossible » universel — **alternative** : drapeaux 15 % / 25 % ancrés ACSM 2–10 %.  
3. **VETO** : tout score basé sur l’apparence, la photo corps, l’âge biologique, ou un score de « récupération médicale » non validé.

**Feu vert science P0** : oui pour coder derrière ces règles, **sans fusion / mise en ligne** sans GO Evan. Retélécharger OPL avant prod pour rafraîchir RF-CAP-01.
