# SPEC_RANKED — Système de Ranked

Statut : **P0 figé + GO science** (29/10/2026). Pas de code.
Sources : MI canvas `98062d04…` ; GO Marketing P0 ; décisions Evan ; `/workspace/ranked_gym/docs/MATRICE_SCIENTIFIQUE_RANKED_FORCE.md`.

## GO science (Vérificateur)
- Verdict : **GO science P0** (soft vetos, 0 veto dur).
- VALIDÉ : Epley 1RM (1–10 reps) · plafonds squat/bench/deadlift · Discipline (séances/7j + streak, plafond 5/sem) · soft reset 6–8 sem · pondération des 5.
- Soft vetos **à appliquer** :
  1. Row / OHP : plafonds **relatifs** (`row ≤ deadlift vérifié`, `OHP ≤ bench vérifié`) + file relecture/vidéo au-dessus de seuils provisoires — pas de plafond absolu inventé.
  2. Anomalies : drapeaux **15 %** (relecture) et **25 %** (refus Force) en ≤ 7 jours (cadre ACSM) — pas un % « impossible » unique.
- Veto dur : look / âge biologique / score récupération médicale.

## Décisions Evan figées (Q1–Q3)
| # | Décision |
|---|----------|
| **Q1** | Cosmétique **Bronze → Légende** inchangé (lié XP/`level`). Compétitif nommé **Ranked Force** (+ **Ranked Discipline** pour le 2ᵉ axe). |
| **Q2** | **5 exercices Force P0 figés (Marketing)** : 1) Squat 2) Développé couché 3) Soulevé de terre 4) Row barre 5) OHP (développé militaire). Isolations / machines / curls = **hors** Force P0. |
| **Q3** | Classement **amis + salle si possible**. Découpage réaliste ci-dessous (§4.5). |

## Alignement P0 Marketing
| Exigence | Statut |
|----------|--------|
| Force + Discipline en P0 | Oui |
| Barème public | Oui |
| Jamais pay-to-win | Oui |
| Plafonds + anomalies + badge Vérifié | Oui (§4.3) |
| Ligues + soft reset P0 | Oui (§4.4) |
| Saisons formelles / clans / B2B | P1 |
| Amis + salle (Q3) | Amis = **P0** ; salle = **P0-bis** (§4.5) — OK Studio |

## 1. Pitch
Classement musculation fiable — **Ranked Force** + **Ranked Discipline**, méthode publique, anti-triche V1, jamais payer le rang.

## 2. Deux couches de rang (Q1 figé)
| Couche | Nom à l’écran | Base | Rôle |
|--------|---------------|------|------|
| Cosmétique | Bronze → Légende (divisions I/II/III actuelles) | `level` / XP (`rank.ts`) | Identité / progression perso — **inchangé** |
| Compétitif Force | **Ranked Force** + divisions / ligues Ranked | PR vérifiés, mouvements de base | Classement compétitif |
| Compétitif Discipline | **Ranked Discipline** | Séances / semaine + streak | Régularité (P0) |

## 3. Charte
- RK-01 : Performance only — jamais apparence.
- RK-02 : Ranked compétitif = **18+** (serveur).
- RK-03 : Jamais pay-to-win sur le rang.
- RK-04 : Opt-in / opt-out.
- RK-05 : Pseudo + avatar seulement dans les classements.
- RK-06 : Formules → Vérificateur avant code.

## 4. P0

### 4.1 Deux rangs compétitifs (P0)
| Rang | Mesure | Entrées |
|------|--------|---------|
| **Ranked Force** | Force absolue | PR mouvements de base **Vérifiés** seulement |
| **Ranked Discipline** | Régularité | Séances terminées / 7 jours (cible 3–5/sem) + streak — **pas** récup / santé |

### 4.1bis Exercices Ranked Force P0 (Q2 figé)
1. Squat
2. Développé couché
3. Soulevé de terre
4. Row barre
5. OHP (développé militaire)

Hors Force P0 : isolations, machines, curls, et tout autre mouvement non listé (peuvent rester en carnet « Déclaré »).

### 4.2 Barème public
- Écran « Comment marche ton rang ».
- Pondération sur les **5** mouvements de base figés (Q2) : squat, développé couché, soulevé de terre, row barre, OHP.
- Déclaré = carnet ; hors Force compétitif.

### 4.3 Anti-triche + badge Vérifié (P0)
- Plafonds physio + anomalies (seuils Vérificateur).
- Badge **Vérifié** obligatoire pour Force compétitif.
- Chemin P0 (sans B2B, sans vidéo obligatoire) : sous plafond + pas d’anomalie + double confirmation (ami 18+ **ou** relecture 24 h).
- Vidéo PR = P1+ / option.

### 4.4 Boucle progression P0
- Ligues / divisions Ranked Force (noms distincts du cosmétique Bronze→Légende).
- Soft reset fin de cycle (~6–8 sem) + promo/relégation conceptuelle.
- Rang figé forever **interdit**.
- Saison formelle (branding, event, passe) = **P1**.

### 4.5 Amis + salle — découpage réaliste (Q3)
Evan veut **amis + salle si possible**. Google Places + présence = lourd (ARCHI_CLASSEMENT_SALLE : quotas, privacy, point salle).

| Lot | Contenu | Pourquoi |
|-----|---------|----------|
| **P0** | Classement Ranked Force / Discipline entre **amis** (opt-in 18+) | Livrable sans Google Places ni GPS |
| **P0-bis** | Classement **par salle** (membres de la même salle choisie) | Réutilise ARCHI_CLASSEMENT_SALLE ; seulement si capacité **après** P0 amis vert |
| **P1** | Salle + inter-salles + saisons formelles + clans | Si P0-bis non tenu dans le même train |

**Écart à noter si P0-bis glisse** : « Classement salle = prévu P0-bis / P1 — pas dans le premier binaire Ranked Force. » Evan / Marketing / Studio valident le glissement.

**P0-bis minimal salle** (si on tente) : salle choisie au profil (place_id ou saisie manuelle) + classement des membres opt-in de **cette** salle ; **sans** validation GPS présence au jour 1 (présence = P1). Moins fiable anti-multi-comptes, acceptable en bêta avec opt-in.

### 4.6 Hors P0
B2B, vidéo obligatoire, clans, saisons formelles, calculateur SEO public.

### 4.7 Plateforme
Cœur gratuit. Écarts : offline partiel ; import Hevy/Strong absent ; export à confirmer → P0-bis plateforme.

## 5. Exigences P0
1. Cosmétique Bronze→Légende inchangé.
2. Ranked Force + Ranked Discipline (noms compétitifs).
3. Barème public.
4. Exercices Force P0 = squat, développé couché, soulevé de terre, row barre, OHP (hors isolations/machines/curls).
5. Plafonds + anomalies + badge Vérifié (§4.3).
6. Ligues + soft reset.
7. Classement **amis** (P0) ; salle = P0-bis.
8. Jamais pay-to-win ; 18+ ; perf only.

## 6. P1
Saisons formelles, salle/inter-salles (si pas P0-bis), clans, vidéo PR.

## 7. Calculs scientifiques — GO (matrice)
Réf. : `/workspace/ranked_gym/docs/MATRICE_SCIENTIFIQUE_RANKED_FORCE.md`

| ID | Sujet | Action produit |
|----|-------|----------------|
| RF-1RM-01 | Epley `w×(1+r/30)`, r≤10 ; r>10 hors Force | Appliquer ; label « 1RM estimé » |
| RF-CAP-01 | Plafonds H/F squat / bench / deadlift | Appliquer chiffres matrice |
| RF-CAP soft | Row / OHP relatifs + file vidéo | Appliquer soft veto |
| RF-ANOM-01 | Drapeaux 15 % / 25 % ≤7 j | Appliquer |
| Discipline | Séances/7j + streak, max 5/sem | Appliquer |
| Soft reset | Cycle 6–8 sem | Appliquer |

Prochaine étape : GO Studio Manager → Architecte / Dev. PM n’écrit pas de code.

## 8. Critères d’acceptation P0
- CA1 : <18 / âge inconnu → refus Ranked compétitif.
- CA2 : PR non Vérifié → hors Force / divisions.
- CA3 : Plafond → refus ; carnet déclaré continue.
- CA4 : Pas d’IAP sur le rang.
- CA5 : Méthode publique accessible.
- CA6 : Soft reset fin de cycle.
- CA7 : Discipline visible (séances/sem ou streak).
- CA8 : Classement amis fonctionne ; salle absente du P0 = documentée si P0-bis reporté.
