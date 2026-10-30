# ARCHI_RANKED — Ranked Force / Ranked Discipline (P0)

Auteur : Architecte Système  
Date : 29/10/2026  
Statut : **spécification** — pas de code app  
Réf. : `SPEC_RANKED.md` · `MATRICE_SCIENTIFIQUE_RANKED_FORCE.md` (5 VALIDÉ + soft veto row/OHP + anomalies)  
Cosmétique Bronze→Légende (`src/utils/rank.ts` / `level` / XP) : **inchangé**, système à côté.

---

## 1. En bref

| Couche | Où | Rôle |
|--------|-----|------|
| Cosmétique Bronze→Légende | Client actuel (`rank.ts`) | Identité / XP — **ne pas toucher** |
| **Ranked Force** | Convex + écrans Ranked | Classement compétitif sur 5 PR **Vérifiés** |
| **Ranked Discipline** | Convex + écrans Ranked | Régularité (séances/7j + streak), plafonnée |

**P0** : opt-in 18+ · amis · ligues + soft reset · anti-triche V1.  
**P0-bis** : classement salle (réutiliser `ARCHI_CLASSEMENT_SALLE.md`) — **hors premier binaire**.  
**Interdits** : poids corporel affiché · pay-to-win · look / âge bio / readiness.

---

## 2. Identifiants mouvements (canonicalExerciseId)

| canonicalExerciseId | Libellé FR | Plafond anti-triche (Matrice) |
|---------------------|------------|-------------------------------|
| `squat` | Squat | Absolu H 515 kg / F 340 kg |
| `bench` | Développé couché | Absolu H 375 kg / F 220 kg |
| `deadlift` | Soulevé de terre | Absolu H 520 kg / F 315 kg |
| `barbell_row` | Row barre | Relatif : ≤ `deadlift` Vérifié ; sinon hors Force |
| `ohp` | OHP (développé militaire) | Relatif : ≤ `bench` Vérifié ; sinon hors Force |

Tout autre mouvement = carnet **Déclaré** uniquement (hors Force).

Mapping client : table de correspondance exercice UI → `canonicalExerciseId` (1 id canonic / variante). Les variantes non mappées = Déclaré.

---

## 3. Formules (IDs Matrice — ne pas inventer)

| ID | Règle | Usage serveur |
|----|-------|---------------|
| **RF-1RM-01** | `1RM = w × (1 + r/30)` ; r entier ; r=1 → 1RM=w ; **2≤r≤10** estimé ; **r>10** → hors Force | Calcul + label « 1RM estimé » ; row/OHP : même formule + mention « estimation non validée pour ce mouvement » |
| **RF-CAP-01** | Plafonds absolus squat/bench/dl ; sexe inconnu → plafond **H** | Refus Force si 1RM > plafond ; carnet Déclaré continue |
| **RF-CAP-01b** | `barbell_row` ≤ deadlift Vérifié ; `ohp` ≤ bench Vérifié | Sinon mouvement hors Force jusqu’à preuve ; seuils provisoires row>250 / OHP>180 → file relecture (pas ban inventé) |
| **RF-ANOM-01** | Δ1RM même mouvement ≤7j : >15 % → drapeau + double conf ; >25 % → refus Force jusqu’à relecture ; historique <8 sem : 25 % / 40 % | Drapeaux produit, pas ban auto hors B |
| **RF-DISC-01** | Séances terminées / 7j glissants ; points plafonnés à **5**/7j ; streak = semaines avec ≥ N séances (N=2 ou 3, produit) ; repos ne casse pas ; pause blessure/maladie | Jamais défi 7/7 |
| **RF-RESET-01** | Cycle 6–8 sem ; soft reset = re-placement partiel ; PR Vérifiés du carnet **conservés** | Pas de wipe forever |

Pondération Force P0 : **égale** sur les 5 (principe Matrice VALIDÉ) ; barème public à l’écran.

---

## 4. Tables Convex (P0)

Préfixe proposé : `ranked*`. Tous les IDs utilisateur = `users` / auth Convex existant.

### 4.1 `rankedOptIn`

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id\<users\> | index unique |
| `forceEnabled` | boolean | défaut false |
| `disciplineEnabled` | boolean | défaut false |
| `optedInAt` | number | ms |
| `optedOutAt` | number? | |
| `ageGatePassedAt` | number | serveur a vérifié âge ≥ 18 |
| `sex` | `"M" \| "F" \| "unknown"` | pour plafonds ; unknown → plafond H |
| `pauseInjuryUntil` | number? | Discipline gelée |

**Règle** : mutations Ranked refusent si `age < 18` OU âge inconnu OU grossesse/allaitement (profil existant, même garde que Photo IA).

### 4.2 `rankedLiftLog` (carnet — Déclaré + candidats Force)

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id | index by_user_exercise_time |
| `canonicalExerciseId` | string | un des 5 ou autre (hors Force) |
| `weightKg` | number | |
| `reps` | number | entier ≥ 1 |
| `estimated1RmKg` | number | calculé serveur RF-1RM-01 ; absent si r>10 (hors Force) |
| `status` | `"declared" \| "pending_verify" \| "verified" \| "rejected_force"` | |
| `anomalyFlag` | `"none" \| "A" \| "B"` | |
| `sourceSessionId` | Id? | lien séance |
| `createdAt` | number | |
| `verifiedAt` | number? | |
| `verifyMethod` | `"self_24h" \| "friend_18" \| "review"`? | |

### 4.3 `rankedVerifiedPr` (meilleur 1RM Vérifié par mouvement — Force)

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id | |
| `canonicalExerciseId` | string | index unique (userId, exercise) |
| `estimated1RmKg` | number | |
| `liftLogId` | Id\<rankedLiftLog\> | |
| `verifiedAt` | number | |
| `cycleId` | Id\<rankedCycle\> | cycle courant au moment du PR compétitif |

### 4.4 `rankedForceScore`

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id | unique par cycle |
| `cycleId` | Id | |
| `score` | number | somme (ou moyenne) des 1RM Vérifiés des 5 ; mouvement manquant = 0 pour l’agrégat P0 |
| `breakdown` | object | `{ squat, bench, deadlift, barbell_row, ohp }` |
| `leagueId` | Id\<rankedLeague\> | |
| `updatedAt` | number | |

### 4.5 `rankedDisciplineScore`

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id | |
| `cycleId` | Id | |
| `sessionsLast7d` | number | 0–5 comptés pour points |
| `streakWeeks` | number | |
| `score` | number | formule produit = f(sessions plafonnées, streak) — **pas** récup |
| `updatedAt` | number | |

### 4.6 `rankedCycle` + `rankedLeague`

**rankedCycle** : `startsAt`, `endsAt` (~6–8 sem), `status` (`active`/`closing`/`closed`), `softResetAt`.  
**rankedLeague** : `cycleId`, `name` (distinct Bronze→Légende), `tier` (ordre), `minScore`, `maxScore` (bornes re-placement).

### 4.7 `rankedFriendship` (classement amis P0)

| Champ | Type | Notes |
|-------|------|-------|
| `userA` / `userB` | Id | pair ordonnée A < B |
| `status` | `"pending" \| "accepted"` | |
| Les deux doivent être opt-in Ranked + 18+ pour apparaître dans le classement ami.

Réutiliser une table amis existante si déjà présente ; sinon celle-ci.

### 4.8 `rankedVerifyRequest`

| Champ | Type | Notes |
|-------|------|-------|
| `liftLogId` | Id | |
| `ownerId` | Id | |
| `method` | `"self_24h" \| "friend_18"` | |
| `friendId` | Id? | ami 18+ opt-in |
| `expiresAt` | number | self_24h : createdAt + 24h → confirmation 2e |
| `status` | `"open" \| "confirmed" \| "expired" \| "denied"` | |

### 4.9 P0-bis (noter, ne pas coder P0)

`userGymMembership` (`place_id` ou salle manuelle) + vue classement membres opt-in **sans GPS jour 1** — voir `ARCHI_CLASSEMENT_SALLE.md`. Hors premier livrable Force/Discipline amis.

---

## 5. Mutations / queries Convex

### 5.1 Accès

| Mutation / query | Rôle |
|------------------|------|
| `ranked.setOptIn` | Active/désactive Force et/ou Discipline après gate 18+ serveur |
| `ranked.getMyStatus` | Opt-in, ligue, scores, pause |
| `ranked.getPublicMethod` | Barème public (textes + formules IDs) — **sans auth obligatoire** pour CA5 |

### 5.2 Saisie & score Force

| Mutation | Règles |
|----------|--------|
| `ranked.submitLift` | Calcule 1RM ; si r>10 → status `declared` only ; sinon tests plafond + relatif row/OHP + anomalie ; status `pending_verify` ou `rejected_force` / `declared` |
| `ranked.requestVerify` | Crée `rankedVerifyRequest` (self_24h ou friend_18) |
| `ranked.confirmVerifySelf` | 2e confirmation ≥24h après submit → `verified` + upsert `rankedVerifiedPr` + recalc score |
| `ranked.confirmVerifyFriend` | Ami 18+ opt-in accepte → idem |
| `ranked.recalcForceScore` | Interne : agrégat 5 mouvements cycle courant |

### 5.3 Discipline

| Mutation | Règles |
|----------|--------|
| `ranked.onSessionCompleted` | Hook depuis fin de séance existante : +1 dans fenêtre 7j si <5 points ; maj streak semaines ; respect `pauseInjuryUntil` |
| `ranked.setInjuryPause` | Gèle streak/Discipline |

### 5.4 Classement & ligues

| Query / mutation | Règles |
|------------------|--------|
| `ranked.leaderboardFriends` | Amis accepted + opt-in ; **pseudo + avatar seulement** ; Force et/ou Discipline |
| `ranked.myLeague` | Ligue + rang approximatif |
| `ranked.closeCycle` (cron / admin) | Soft reset : re-placement ligue selon score ; **ne wipe pas** `rankedVerifiedPr` carnet ; nouveau `cycleId` |

### 5.5 Interdits serveur

- Aucun champ `bodyweight` lu/écrit pour Ranked.
- Aucun IAP / flag premium qui change score, ligue ou badge.
- Aucune photo corps / look / âge bio.

---

## 6. Flux anti-triche (résumé)

```
submitLift
  → r > 10 ? → Déclaré only (hors Force)
  → 1RM = Epley
  → plafond absolu (squat/bench/dl) dépassé ? → rejected_force + Déclaré OK
  → row/OHP : pas de PR ref Vérifié ? → hors Force
  → row/OHP : 1RM > ref Vérifié ? → hors Force (+ file si > seuils provisoires)
  → anomalie A/B selon Δ 7j (+ tolérance novice <8 sem)
  → sinon pending_verify
       → self_24h (2e conf) OU ami 18+
       → verified → entre dans Force / ligues
       → Déclaré reste visible carnet perso sans badge
```

Badge **Vérifié** = seul ticket Force compétitif.  
**Déclaré** = carnet, jamais ligues Force.

---

## 7. Écrans client (P0)

| Écran | Contenu |
|-------|---------|
| **Opt-in Ranked** | Explication 18+ · Force / Discipline séparés · CGU courtes · pas de poids corporel demandé |
| **Comment marche ton rang** | Barème public : 5 mouvements · Epley 1–10 · plafonds · Vérifié · Discipline plafonnée 5/sem · ligues + soft reset |
| **Carnet / PR** | Liste lifts ; badge Vérifié / Déclaré / En attente ; CTA double conf ou ami |
| **Ranked Force** | Score + breakdown 5 · ligue · pas de BW |
| **Ranked Discipline** | Séances/7j (max 5 pts) · streak semaines · pause blessure |
| **Classement amis** | Pseudo + avatar + score Force ou Discipline · opt-out = disparition |
| Cosmétique Accueil | Bronze→Légende **inchangé** (XP) — Ranked = entrée dédiée (onglet ou carte) |

P0-bis salle : écran reporté (noter dans backlog).

---

## 8. Critères d’acceptation (archi ↔ SPEC CA1–CA8)

| ID | Critère | Preuve |
|----|---------|--------|
| CA1 | <18 / âge inconnu → refus Ranked compétitif | `setOptIn` + guards mutations |
| CA2 | PR non Vérifié → hors Force / ligues | seul `rankedVerifiedPr` alimente score |
| CA3 | Plafond → refus Force ; carnet Déclaré continue | `submitLift` |
| CA4 | Pas d’IAP sur le rang | revue code + pas de champ premium dans scores |
| CA5 | Méthode publique accessible | écran + `getPublicMethod` |
| CA6 | Soft reset fin de cycle | cron `closeCycle` ; PR carnet conservés |
| CA7 | Discipline visible | écran + score plafonné |
| CA8 | Classement amis OK ; salle = P0-bis documenté | `leaderboardFriends` ; section 4.9 |

Tests unitaires serveur attendus (pour Dev, hors ce livrable) : Epley r=1..10 / r=11 ; plafonds H/F/unknown ; row≤dl ; OHP≤bench ; anomalies A/B/novice ; Discipline 6e séance = 0 pt ; opt-in mineur refus.

---

## 9. Découpage livraison

| Lot | Contenu | Dépendance |
|-----|---------|------------|
| **P0-a** | Opt-in 18+ · submitLift · plafonds · Déclaré/Vérifié · barème public | Matrice |
| **P0-b** | Scores Force/Discipline · amis leaderboard · écrans | P0-a |
| **P0-c** | Ligues + soft reset cron | P0-b |
| **P0-bis** | Salle (ARCHI_CLASSEMENT_SALLE) | Après P0 amis vert + capacité |

Pas de fusion / mise en ligne sans GO Evan. Retélécharger export OpenPowerlifting avant prod (Matrice).

---

## 10. Hors scope P0

Saisons formelles · clans · vidéo PR obligatoire · B2B · classement inter-salles · Google Places présence · modifier Bronze→Légende cosmétique.
