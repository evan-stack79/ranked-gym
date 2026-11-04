# ARCHI_REWARDS_PARTENAIRES — Points partenaires / boutique cadeaux (v0)

Auteur : Architecte Système  
Date : 4/11/2026  
Statut : **spécification** — pas de code app  
Réf. : `PRD.md` §RP v0.1 FIGÉ · `SPEC_RANKED.md` §9 · fiche MI canvas · RK-03 · alerte Juriste 4/11  
Aligné : `ARCHI_RANKED.md` (Discipline, soft reset cycle) — **wallet séparé**.

---

## 1. En bref

| Couche | Où | Rôle |
|--------|-----|------|
| Ranked Force / Discipline | Convex ranked* | Scores compétitifs — **inchangés** |
| Cosmétique Bronze→Légende / Pass | Client + entitlements | Look / confort — **hors catalogue cadeaux** |
| **Points partenaires** | Convex `rewards*` | Wallet saisonnier, échange → code unique caisse |

**Canal boutique ≠ hub scores** (RP-07 / RK-03).  
**Interdits** : achat de points · hasard / loot · `pointMultiplier` / `capBonus` / earlyAccess catalogue Pro · points qui boostent Force/Discipline · affichage € · transfert entre comptes.

---

## 2. Proposition économie (GO Evan avant code)

Barèmes Product (RP.3) : snack ~90–120 · café ~150 · complément ~200–400.

| Paramètre | Valeur proposée | Notes |
|-----------|-----------------|-------|
| **Taux séance** | **+10 pts** / séance Discipline **validée** | Hook post-validation uniquement (RP-01, RP-F02) |
| **Taux objectif semaine** | **+20 pts** / objectif semaine validé (max 1× / semaine ISO) | Alternative RP-01 ; pas cumulable 2× le même objectif |
| **Plafond journalier** | **50 pts / jour UTC** | Identique free / Pro (RP-03) — **à GO Evan** |
| **Plafond saison** | **1 200 pts / cycle** (durée = cycle soft reset Ranked 6–8 sem) | Identique free / Pro ; coupe le stock infini (RP-05) |
| **Config** | Table `rewardsEconomyConfig` (une ligne active) | Changements = migration + annonce ; jamais différencié par plan |

**Feeling** : 1 semaine régulière (3–5 séances) ≈ 30–50 pts → snack en ~2–3 semaines ; café (~150) ≈ 3–4 semaines ; pas de rush journalier utile au-delà de 50.

**Hors GO Evan** : ne pas coder les constantes en dur client ; lire serveur.

---

## 3. Entitlements Pro (anti-P2W)

| Flag autorisé Pro | Effet |
|-------------------|--------|
| Cosmétiques / badges / confort UI | Oui (hors ce module catalogue) |
| `pointMultiplier` | **Interdit** (schema reject) |
| `capBonus` / plafond plus haut | **Interdit** |
| `earlyAccess` / catalogue exclusif / date dispo Pro | **Interdit** (RP-09) |

Catalogue query : **même feed** pour tous les users authentifiés éligibles — aucun filtre `plan === pro`.

---

## 4. Tables Convex (préfixe `rewards`)

Tous les `userId` = auth Convex existant. Index nommés explicitement.

### 4.1 `rewardsWallet`

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id\<users\> | index unique by_user |
| `cycleId` | Id\<rankedCycle\> | même cycle soft reset Force/Discipline |
| `balance` | number | ≥ 0 ; pts utilisables **cette** saison |
| `earnedToday` | number | reset à minuit UTC |
| `earnedTodayDate` | string | `YYYY-MM-DD` UTC |
| `earnedThisCycle` | number | plafond saison |
| `updatedAt` | number | |

**Invariant** : jamais écrit depuis boutique IAP / Pass. Mutations `rewards*` only.

### 4.2 `rewardsLedger` (append-only)

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | Id | index by_user_time |
| `cycleId` | Id | |
| `delta` | number | + crédit / − débit |
| `reason` | `"discipline_session" \| "week_objective" \| "redeem" \| "season_reset" \| "partner_refuse_recredit" \| "admin_adjust"` | |
| `refId` | string? | sessionId / objectiveId / redemptionId |
| `createdAt` | number | |
| `balanceAfter` | number | |

Idempotence crédit : index unique `(userId, reason, refId)` quand `refId` présent → pas de double crédit même séance.

### 4.3 `rewardsPartner`

| Champ | Type | Notes |
|-------|------|-------|
| `slug` | string | unique |
| `name` | string | |
| `active` | boolean | |

### 4.4 `rewardsCatalogItem`

| Champ | Type | Notes |
|-------|------|-------|
| `partnerId` | Id\<rewardsPartner\> | |
| `categoryId` | `"RP-CAT-01"…"` | |
| `title` | string | |
| `costPoints` | number | > 0 |
| `stockLogical` | number | décrémente à l’émission code |
| `active` | boolean | |
| `availableFrom` | number | ms — **identique** free/Pro |
| `availableTo` | number? | |
| `sortOrder` | number | |

**Interdit en schema** : champs `proOnly`, `earlyAccessPro`, `minPlan`.

### 4.5 `rewardsRedemptionCode`

| Champ | Type | Notes |
|-------|------|-------|
| `code` | string | unique ; opaque ; haute entropie |
| `userId` | Id | propriétaire |
| `itemId` | Id\<rewardsCatalogItem\> | |
| `costPoints` | number | snapshot au checkout |
| `status` | `"created" \| "shown" \| "consumed" \| "expired" \| "partner_refused" \| "invalidated"` | |
| `cycleId` | Id | cycle d’émission |
| `createdAt` | number | |
| `expiresAt` | number | TTL code (prod : ex. 30 j — config) |
| `shownAt` | number? | |
| `consumedAt` | number? | |
| `partnerRefuseAt` | number? | |
| `partnerRefuseReason` | string? | |
| `recreditLedgerId` | Id? | si RP-14 |

### 4.6 `rewardsSeasonLot` (lots fin de saison — P0 optionnel / P0bis)

| Champ | Type | Notes |
|-------|------|-------|
| `cycleId` | Id | |
| `leagueTier` | string | rang ligue |
| `itemId` | Id? | ou `bonusPoints` number |
| `rulesVersion` | string | **mêmes** règles free/Pro |

### 4.7 `rewardsEconomyConfig`

| Champ | Type | Notes |
|-------|------|-------|
| `ptsPerValidatedSession` | number | prop. 10 |
| `ptsPerWeekObjective` | number | prop. 20 |
| `dailyCap` | number | prop. **50** |
| `seasonCap` | number | prop. **1200** |
| `codeTtlMs` | number | |
| `activeFrom` | number | |

---

## 5. Mutations / queries

### 5.1 Crédit (serveur only)

`rewards.creditFromDiscipline` — appelée **uniquement** depuis le chemin post-validation Discipline (`ARCHI_RANKED` / mutation session validée), jamais depuis le client brut.

Flux :
1. Vérifier opt-in / user existant.
2. Idempotence `(userId, reason, refId)`.
3. Lire config ; calculer `grant = min(taux, dailyRemaining, seasonRemaining)`.
4. Si `grant ≤ 0` → no-op loggé.
5. Patch wallet + insert ledger.

**Jamais** lire le plan Pro pour majorer `grant`.

### 5.2 Catalogue

`rewards.listCatalog` — items `active` + fenêtre dates ; **pas** de branche plan.  
`rewards.getWallet` — solde + earnedToday + earnedThisCycle + caps (pour UI barre plafond).

### 5.3 Checkout atomique

`rewards.redeemItem({ itemId })` (mutation transactionnelle) :
1. Lock logique item + wallet user.
2. Vérifier `balance ≥ cost` · item active · stockLogical > 0 · dans fenêtre dates.
3. Décrémenter balance + stockLogical.
4. Générer `code` unique (retry collision) ; status `created`.
5. Ledger `redeem` négatif.
6. Retourner code une fois ; passer `shown` à la 1ʳᵉ lecture UI.

Échec → rollback complet (pas de code orphelin ni débit).

### 5.4 Consommation / refus partenaire

`rewards.markConsumed({ code })` — partenaire / backoffice / webhook futur → `consumed`.  
`rewards.partnerRefuse({ code, reason })` — si status ∈ {created, shown} et non expiré :
1. status → `partner_refused` puis `invalidated`.
2. Recrédit `costPoints` (dans caps saison ? **Oui recrédit même si seasonCap** — exception RP-14 ; tag ledger `partner_refuse_recredit` ; ne pas recompter dans earnedThisCycle pour ne pas bloquer le joueur).
3. Log motif (RP-F11 / F12).

### 5.5 Soft reset saison

Sur close cycle Ranked (`closeCycleCore` / cron existant) **hook** `rewards.onCycleClose(cycleId)` :
1. Annonce UI **avant** (flag `rewardsResetAnnouncedAt` / notif — Product).
2. Pour chaque wallet du cycle : ledger `season_reset` (−balance) ; balance → 0 ; earnedThisCycle → 0.
3. **Ne pas** toucher `rewardsRedemptionCode` déjà émis (RP-13).
4. Force / Discipline scores : inchangés (ARCHI_RANKED).

### 5.6 Interdits (garde serveur)

- Aucune mutation `buyPoints` / IAP handler credits rewards.
- Aucun `Math.random` sur attribution item.
- Reject args contenant multiplicateur / cap bonus.

---

## 6. Écrans client (séparation RK-03)

| Écran | Contenu | Interdit |
|-------|---------|----------|
| Hub Force / Discipline / ligues | Scores, PR, amis | CTA Pass, coins, boutique cadeaux, solde points partenaires |
| **Boutique partenaires** (entrée Réglages / onglet dédié hors Ranked) | Solde, catalogue, historique codes | Scores Force/Discipline, CTA « monte de ligue » |
| Détail item → Confirmer échange | Coût pts, partenaire, CGU courte | Prix €, « équivalent argent » |
| Mes codes | Liste status + copier | |

Navigation : deep-link boutique **ne** passe **pas** par le hub scores (RP-F09).

---

## 7. Critères d’acceptation Dev (miroir PRD)

| ID | Critère |
|----|---------|
| CA-RP1 | Même activité Discipline → mêmes pts free vs Pro ; même plafond |
| CA-RP2 | Impossible acheter points / multiplicateur / cap plus haut |
| CA-RP3 | Code one-shot ; 2ᵉ redeem / réutilisation refusée |
| CA-RP4 | Fin cycle → solde 0 ; codes émis restent valables |
| CA-RP5 | Aucun CTA Pass sur écrans score via ce lot |
| CA-RP6 | ≥ 3 catégories catalogue ; feed identique free/Pro |
| CA-RP7 | Refus partenaire → recrédit + code invalidé |
| CA-RP8 | Pas de hasard sur attribution |
| CA-RP9 | Aucun item / date réservé Pro |

---

## 8. Lots livraison

| Lot | Contenu | Dépendance |
|-----|---------|------------|
| **RP-a** | Tables wallet + ledger + config ; crédit hook Discipline ; caps | GO Evan sur **50 pts/j** + 1200/saison (ou chiffres amendés) |
| **RP-b** | Catalogue + redeem atomique + mes codes | RP-a |
| **RP-c** | Reset saison hook + partnerRefuse recrédit + logs | RP-b |
| **RP-d** | Lots fin de saison (optionnel) | SPEC lot figé |

**Pas de code** tant que Studio n’a pas redistribué le brief Dev après GO plafond Evan.

---

## 9. Hors scope v0

- Liste marques FR, stock physique Ranked Gym.
- CGU rewards longues (Juriste).
- Webhook caisse partenaire temps réel (v0 = markConsumed manuel / outil support).
- 18+ redemption magasin — flag Juriste ultérieur (RP-F10).

---

## 10. Décision ouverte (Evan)

Confirmer ou amender avant code :

1. **Plafond journalier = 50 pts** ?  
2. **Plafond saison = 1 200 pts** ?  
3. **Taux = +10 / séance validée** et **+20 / objectif semaine** ?

Studio Manager porte le GO Evan ; Archi n’écrit pas de code.
