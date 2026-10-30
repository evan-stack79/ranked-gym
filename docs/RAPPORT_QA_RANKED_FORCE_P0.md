# Rapport QA — Ranked Force P0 (PR #135)

## Boucle 1 / 3 — dd48298
Date : 29/10/2026, ~19:45 (heure de Paris). Lecture seule : aucune modif de code, aucune écriture GitHub, aucun déploiement, aucune donnée prod, aucune connexion.

### Base
- PR #135 ouverte, branche `cursor/ranked-force-p0-67af`. SHA dd48298d583a au début et à la fin (inchangé).
- CI de la PR : `ci` ✅ (run 40929433005) et `Build unsigned iOS IPA` ✅ (run 40929432989).
- Clone neuf /tmp, Node 22.11 :
  - vitest 1568/1568 (253 fichiers), lancé 2 fois ✅ ;
  - tsc -b ✅, tsc -p convex ✅ ;
  - vite build ✅ et oxlint 0 erreur ✅. Les deux ont d'abord échoué à cause de binaires natifs absents après `npm ci` (rolldown/oxlint linux). C'est un problème de l'environnement, pas du code. Ces binaires ont été installés en local avec `--no-save`.
- Diff : 18 fichiers.
  - `convex/ranked.ts` : +1173 lignes.
  - Fichiers ajoutés : `convex/lib/rankedScience.ts`, `convex/lib/rankedAccess.ts`, `RankedScreens.tsx` et `rankedService.ts`.
  - Fichiers modifiés : crons.ts, schema.ts, TrainingView.tsx.

### Critères d'acceptation
| CA | Attendu | Obtenu | Statut |
|---|---|---|---|
| CA1 | Moins de 18 ans ou âge inconnu → refus | Garde serveur `assertRankedCompetitiveAccess` : âge inconnu, mineur, grossesse et allaitement refusés. Elle est appelée dans setOptIn, submitLift, requestVerify, les confirmations, onSessionCompleted et les amis. Le classement re-filtre aussi. | ✅ |
| CA2 | PR non Vérifié → hors Force | Le score est calculé seulement depuis `rankedVerifiedPr` (rempli uniquement par `markVerifiedAndScore`). | ✅ (mais voir B2) |
| CA3 | Plafond → refus, le carnet continue | Bench 376 kg H → `rejected_force`. La ligne reste dans le carnet. Sexe inconnu → plafond H. | ✅ |
| CA4 | Pas d'IAP sur le rang | Aucun premium, IAP ou achat dans les fichiers Ranked. Le score dépend seulement des PR vérifiés. | ✅ |
| CA5 | Méthode publique accessible | `getPublicMethod` est sans authentification côté serveur. Mais dans l'app, l'écran est derrière la connexion (route `ranked` → requireAuth). | ⚠️ M3 |
| CA6 | Soft reset en fin de cycle | Le cron quotidien `closeCycleCron` existe et ne supprime pas les PR. Mais le « soft reset » copie le score à 100 % et le score est recalculé depuis les PR de tous les temps : il n'y a donc aucun re-placement. De plus, le cycle est souvent remplacé avant que le cron passe. | ❌ B4 |
| CA7 | Discipline visible | Écran Discipline : séances sur 7 j (5 maximum), streak en semaines (≥ 3 séances) et pause blessure. | ✅ affichage, ❌ anti-triche (B3) |
| CA8 | Classement amis fonctionne ; salle documentée P0-bis | Le serveur a request/respond friendship et leaderboardFriends. **Mais l'app n'a aucun écran pour ajouter ou accepter un ami** : le classement n'affiche que soi-même. La salle est bien notée P0-bis (écran, serveur, RANKED_P0_SCOPE_NOTE). | ❌ B1 |

### Autres points
- **Cosmétique Bronze→Légende** : `src/utils/rank.ts` a 0 ligne de diff. Les noms des ligues sont distincts (Fer, Acier, Chrome, Obsidienne, Mythique) ✅.
- **Pas de P2W** ✅. Le poids corporel n'est ni lu ni affiché ✅.
- **Science** :
  - Epley ✅ (r=1 → w, 10 reps × 100 kg = 133,3 kg, 11 reps → déclaré).
  - Plafonds H/F/inconnu ✅. Discipline plafonnée à 5 sur 7 j ✅. Streak en semaines, le repos ne le casse pas ✅.
- **Soft vetos row/OHP** :
  - Plafond relatif ✅ : row sans deadlift vérifié → hors Force ; row 160 > deadlift 150 → hors Force ; OHP sans bench → hors Force.
  - Seuils provisoires row > 250 / OHP > 180 → seulement un drapeau `needsReviewQueue`, auto-confirmable après 24 h. **La file de relecture n'existe pas** (M1).
  - **Soft veto respecté pour le plafond relatif, à moitié pour la file de relecture.**
- **Anti-triche serveur** : l'identité vient toujours du jeton de session côté serveur, et le 1RM est calculé côté serveur ✅. Mais il y a les trous B2 et B3.

### Bugs
**BLOQUANT (4)**
- **B1 — Classement amis inutilisable (CA8).**
  - Repro : Profil → Ranked → Classement amis.
  - Constaté : aucun bouton pour ajouter ou accepter un ami. `requestRankedFriendship` n'est jamais appelé dans l'UI et `respondFriendship` n'existe pas côté client. Le classement montre seulement soi.
  - Même chose pour la vérification par un ami : l'UI ne propose que le self 24 h.
- **B2 — Contournement des anomalies (RF-ANOM-01).** La référence est « le dernier lift saisi », même s'il a été refusé.
  - Repro A : historique bench 100 kg ; saisir 200 kg → `rejected_force` B ; ressaisir 200 kg une minute après → `pending_verify`, sans drapeau. 24 h plus tard, confirmation self → Vérifié.
  - Repro B (escalier) : saisir +14 % à chaque fois (100 → 114 → 130 → … ≈ 370 kg) en quelques minutes : aucun drapeau.
  - Attendu : comparer au meilleur 1RM vérifié ou au plus bas des 7 derniers jours, et ignorer les lifts refusés.
- **B3 — Discipline : le serveur fait confiance au client.** `onSessionCompleted` accepte un `completedAt` libre et n'est lié à aucune vraie séance.
  - Repro : appeler la mutation 3 fois par semaine avec des dates passées → streak de N semaines immédiat. Ou l'appeler 5 fois → 5 points.
  - **En plus**, avec un `completedAt` dans le futur, `ensureActiveCycle` ferme le cycle actif et en crée un nouveau, **pour tout le monde**. Les scores Force et Discipline de tous les joueurs disparaissent du classement (le cycle est global).
- **B4 — Soft reset inopérant (CA6).**
  - `closeCycleCore` recopie le score à l'identique, et `recalcForceScoreInternal` recalcule depuis les PR de tous les temps : le rang est figé pour toujours (interdit par la SPEC §4.4).
  - Repro : PR vérifiés → fin de cycle → même score et même ligue dans le nouveau cycle.
  - De plus, la première mutation après `endsAt` crée un nouveau cycle sans rien reprendre. L'ancien reste « closing » et le cron voit ensuite un cycle actif valide, donc ne fait rien.

**MOYEN (3)**
- **M1** — File de relecture absente : row > 250, OHP > 180 et anomalie A (« double conf ») passent par le simple self 24 h. Il n'existe aucune mutation de relecture humaine (les refus B ne peuvent jamais être relus).
- **M2** — Désinscription impossible si la garde échoue : `setOptIn(false,false)` vérifie d'abord l'âge, la grossesse et l'allaitement. Une personne enceinte ou dont l'âge a été effacé ne peut pas se désinscrire (RK-04). Le classement la masque, mais la ligne d'inscription reste.
- **M3** — CA5 : le barème public n'est visible qu'une fois connecté dans l'app.

**MINEUR (4)**
- m1 — `leaderboardFriends` renvoie le `userId` des amis (RK-05 : pseudo + avatar seulement).
- m2 — `requestFriendship` accepte n'importe quel id (même inexistant), sans limite de fréquence.
- m3 — La mention « estimation non validée pour row/OHP » est dans `getPublicMethod` mais n'apparaît pas dans le carnet.
- m4 — Le sexe vient du profil nutrition modifiable : une femme peut passer en « inconnu » pour obtenir les plafonds H. C'est conforme à la Matrice, à noter seulement.

### Verdict boucle 1 : **NO-GO** — 4 BLOQUANT, 3 MOYEN, 4 MINEUR.
La science (Epley, plafonds, row/OHP relatifs, Discipline plafonnée) est bien codée. Les blocages viennent de l'anti-triche (B2, B3), du soft reset (B4) et des amis absents de l'app (B1).

---

## Boucle 2 / 3 — 6f31657
Date : 29/10/2026, ~20:00 (heure de Paris). Lecture seule : aucune modif de code, aucune écriture GitHub, aucun déploiement, aucune donnée prod, aucune connexion.

### Base
- SHA 6f31657f652c au début et à la fin (tête de la PR #135 inchangée). Un seul commit depuis dd48298 : « fix(ranked): QA loop1 B1–B4… » (10 fichiers, +900/−137).
- CI : `ci` ✅ (run 40932174547) et `Build unsigned iOS IPA` ✅ (run 40932174536).
- Clone neuf, Node 22.11 :
  - vitest 1571/1571 (253 fichiers), lancé 2 fois ✅ ;
  - tsc -b ✅, vite build ✅, oxlint 0 erreur ✅, tsc -p convex ✅.
  - Les binaires natifs rolldown/oxlint ont été installés en `--no-save`, comme en boucle 1 (problème d'environnement).

### Re-test des anciens bloquants
| # | Attendu | Obtenu | Statut |
|---|---|---|---|
| B1 | Ajouter, accepter et refuser un ami ; vérification par un ami 18+ ; classement vide sans amis | Serveur : `listMyFriendships`, `listIncomingVerifyRequests` ; requestFriendship refuse un id inexistant et limite à 20 demandes/h. Classement sans amis → `no_friends`, liste vide. UI : champ « Ajouter un ami », boutons Accepter/Refuser, demande et réponse de vérification par un ami. **Mais le champ demande le « User id Ranked de ton ami », et l'app n'affiche nulle part ton propre id** : impossible de le donner à un ami. | ❌ **B1-bis** (reste bloquant en pratique) |
| B2 | Référence = meilleur 1RM vérifié ou le plus bas sur 7 j ; ignorer `rejected_force` | Test : un 200 kg refusé B puis ressaisi → **toujours refusé B** ✅. Escalier +14 % : 114 kg accepté, puis 130, 148… → refus B ✅. | ✅ corrigé (voir M4/M6) |
| B3 | Plus de `completedAt` venant du client ; heure serveur ; `sourceSessionId` obligatoire | `completedAt` est retiré de la mutation. L'heure est celle du serveur. `sourceSessionId` est obligatoire et dédoublonné. TrainingView envoie l'id de la séance sauvegardée. Une date future ne peut plus effacer le cycle ✅. **Mais l'id n'est pas comparé aux vraies séances** (M5). | ✅ corrigé (le bloquant), reste M5 |
| B4 | Seed à 50 % ; score limité au cycle ; un cycle expiré passe par closeCycleCore | `ensureActiveCycle` lance closeCycleCore si le cycle a expiré, et le cron fait pareil. Seed = 50 % (500 → 250 → 125 → 62). Le score = seed + PR vérifiés **dans ce cycle**. Les PR du carnet sont conservés. | ✅ corrigé (voir M7) |

### Anciens M et m
- **M1** ✅ : self 24 h interdit si `needsReviewQueue` (anomalie A, row > 250, OHP > 180). Ajout de la relecture admin `confirmVerifyReview`. Un ami 18+ reste possible.
- **M2** ✅ : la désinscription passe avant la garde d'âge et de grossesse.
- **M3 / CA5** ✅ : le hub et le barème s'ouvrent sans connexion ; les actions demandent la connexion.
- **m1** ✅ : plus de `userId` dans le classement.
- **m2** ✅ : ids inexistants refusés et limite de fréquence.
- **m3** ✅ : la mention « estimation non validée pour row/OHP » est dans le carnet.
- **m4** : inchangé (conforme à la Matrice).

### Critères d'acceptation (boucle 2)
- CA1 ✅
- CA2 ✅
- CA3 ✅
- CA4 ✅
- CA5 ✅
- CA6 ✅
- CA7 ✅, avec M5
- **CA8 ❌** (B1-bis)

Cosmétique Bronze→Légende : 0 diff sur rank.ts ✅. Pas de P2W ✅. Soft vetos row/OHP : plafond relatif ✅ et file de relecture ✅ (admin ou ami).

### Bugs restants
**BLOQUANT (1)**
- **B1-bis — Impossible d'ajouter un ami dans la vraie app.**
  - Repro : Profil → Ranked → Classement amis → « Ajouter un ami ». Le champ demande un « User id Ranked ».
  - Aucun écran n'affiche ton id ni celui d'un ami (Ranked, Profil, Réglages). Il n'y a pas non plus de recherche par pseudo. Deux vrais utilisateurs ne peuvent donc pas devenir amis, et CA8 n'est pas utilisable.
  - Correctif simple : afficher et copier son id ou un code ami, ou chercher par pseudo.

**MOYEN (4)**
- **M4 — Faux positifs avec la règle du « plus bas sur 7 j »** (régression du fix B2). La référence prend le lift le plus léger de la semaine, échauffements et jours légers compris.
  - Repro : bench vérifié 100 kg il y a 2 j ; saisir un échauffement à 50 kg ; saisir 100 kg → **refus B** (+100 % par rapport à 50).
  - Un utilisateur honnête est bloqué jusqu'à une relecture admin.
- **M5 — `sourceSessionId` n'est pas vérifié côté serveur.** N'importe quelle chaîne est acceptée.
  - Repro : appeler `onSessionCompleted` avec « a », « b », « c », « d », « e » → 5 points Discipline sans séance, et un streak qui monte de 1 par semaine.
  - Ce n'est plus possible dans le passé ni dans le futur, mais la Discipline reste déclarative.
- **M6 — Aucun contrôle d'anomalie au premier lift ou après plus de 7 jours.**
  - Repro : nouveau compte, premier bench à 370 kg → `pending_verify`, sans drapeau. Après 24 h : self-vérifié. Même chose avec un PR vérifié à 100 kg vieux de 30 j puis 300 kg.
  - C'est conforme à la lettre de la Matrice (≤ 7 j), mais seul le plafond protège. À trancher par le Vérificateur.
- **M7 — Le rang d'un pratiquant qui stagne fond à chaque cycle.** Un PR ne compte dans le nouveau cycle que s'il bat le record de tous les temps. Sinon `rankedVerifiedPr` ne change pas de cycle.
  - Repro : 500 de score, mêmes charges vérifiées chaque cycle → 250, puis 125, puis 62.
  - Les nouveaux inscrits démarrent au contraire à 100 % de leurs PR (bootstrap), alors que les anciens sont à 50 %.

**MINEUR (4)**
- m5 — L'UI affiche des codes d'erreur bruts (ex. `RANKED_NEEDS_REVIEW_OR_FRIEND`, `RANKED_FRIEND_NOT_FOUND`).
- m6 — closeCycleCore peut tourner dans la mutation d'un utilisateur et parcourir tous les scores. C'est un risque de limite Convex si la base grandit.
- m7 — Un ami peut valider un lift de la file de relecture (row > 250, OHP > 180). La Matrice parle de « relecture / vidéo » : à confirmer par le Vérificateur.
- m4 (boucle 1) — le sexe vient du profil modifiable (conforme à la Matrice).

### Verdict boucle 2 : **NO-GO** — 1 BLOQUANT, 4 MOYEN, 4 MINEUR.
B2, B3 et B4 sont corrigés, ainsi que M1–M3 et m1–m3. Il reste un blocage : on ne peut pas ajouter d'ami dans l'app (pas d'id visible). M4 (faux refus) est à corriger en même temps.

---

## Boucle 3 / 3 — correctifs Studio (dev)

- **B1-bis** : code ami court (8 car.) + copier / coller ; résolution serveur `friendCode` → user.
- **M4** : baseline = 1RM **vérifié** (plus de min échauffements).
- **M5** : `sourceSessionId` doit exister dans `workouts_state` de l’user.
- **M6 / M7** : notés hors boucle (Vérificateur / design soft reset) — pas de fix science inventé.
