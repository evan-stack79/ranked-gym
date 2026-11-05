# ARCHI_OUTIL_PARTENAIRE — Page web caisse marques (v0)

Auteur : Architecte Système  
Date : 4/11/2026 (~20:25 Paris)  
Statut : **spécification + GO Evan 4/11/2026** (Studio Manager) — lots OP-a…d en cours / livrés en PR  
 
Réf. : `PRD.md` §OP (OP.0–OP.8, CA-OP1…9) · `ARCHI_REWARDS_PARTENAIRES.md` §5.4 · RK-03 · RP-14  

---

## 1. En bref

| Couche | Où | Rôle |
|--------|-----|------|
| App joueur Ranked Gym | Capacitor / Convex auth joueur | Boutique, codes, scores — **inchangé** |
| Backend rewards | Convex `rewards.*` | Source de vérité codes / wallet (§5.4) |
| **Outil partenaire** | **2ᵉ site web** sur **VPS Evan** | Caisse : code → Oui donné / Non rupture |

**Interdits** : même origine que le site marketing Ranked Gym · accès joueur · affichage Force/Discipline/ligue/€ · paiement stock Ranked Gym · `partnerRefuse` / `markConsumed` sans rôle partenaire ou `rg_admin` · recrédit initié par le joueur.

---

## 2. Hébergement VPS (OP-02, OP-F01, CA-OP5)

| Décision | Détail |
|----------|--------|
| Machine | VPS **déjà en place** chez Evan (même hôte possible) |
| Site | **2ᵉ vhost / sous-domaine** dédié (ex. `partners.<domaine>` ou domaine distinct) — **pas** le document root du vrai site Ranked Gym |
| TLS | HTTPS obligatoire (Let's Encrypt / cert existant) |
| Stack front v0 | App web statique légère (HTML/JS ou Vite build) **séparée** du repo app joueur côté déploiement ; parle **uniquement** à Convex (HTTPS) |
| CORS / Convex | Origine outil partenaire whitelistée côté Convex ; origine site marketing **sans** droits mutations partenaire |
| Secrets | Variables d’env VPS uniquement (URL Convex, deploy key si besoin) — **pas** de clé admin dans le bundle public |
| SPA fallback | Routes front → `index.html` ; pas de reverse-proxy vers l’app joueur |

**Hors v0** : CDN Cloudflare obligatoire, multi-région, WAF avancé — optionnel si déjà sur le VPS.

---

## 3. Auth partenaire (OP-A01…04, OP-F02, CA-OP1)

### 3.1 Tables Convex (préfixe `partnerAuth` ou `rewardsPartner*`)

#### `rewardsPartnerAccount`

| Champ | Type | Notes |
|-------|------|-------|
| `email` | string | unique, normalisé lower |
| `passwordHash` | string | hash serveur only (jamais renvoyé au client) |
| `partnerId` | Id\<rewardsPartner\> | marque / salle rattachée |
| `role` | `"partner_staff" \| "partner_admin" \| "rg_admin"` | OP-A02 |
| `active` | boolean | désactivation = plus de login |
| `createdAt` | number | |
| `lastLoginAt` | number? | |

#### `rewardsPartnerInvite` (option invitation)

| Champ | Type | Notes |
|-------|------|-------|
| `token` | string | unique, haute entropie, one-shot |
| `partnerId` | Id | |
| `role` | `"partner_staff" \| "partner_admin"` | pas d’invite `rg_admin` en masse |
| `email` | string? | prérempli |
| `expiresAt` | number | |
| `usedAt` | number? | |

#### `rewardsPartnerSession` (si sessions custom) **ou** Convex Auth / JWT court

| Champ | Type | Notes |
|-------|------|-------|
| `accountId` | Id | |
| `tokenHash` | string | |
| `expiresAt` | number | **session courte** (prop. **8 h** idle max ; idle timeout prop. **30 min** sans action) |
| `revokedAt` | number? | |

`rg_admin` : comptes créés **manuellement** (Evan / Studio) — pas d’auto-inscription.

### 3.2 Flux auth

1. Login e-mail + mdp → session cookie `HttpOnly` `Secure` `SameSite=Strict` (ou token Bearer stocké mémoire, pas `localStorage` long).  
2. Invitation : lien one-shot → choisir mdp → compte `active` → invite `usedAt`.  
3. Déconnexion explicite + auto à expiry.  
4. **1 compte = 1 employé** (recommandé UI ; pas de partage de session multi-onglets géré en v0).  
5. `partner_admin` : CRUD comptes `partner_staff` **de sa seule** `partnerId`.  
6. Joueur Convex (auth app) **≠** compte partenaire — **pas** de SSO joueur→outil.

### 3.3 Garde serveur (OP-F06, CA-OP4)

Toute mutation `rewards.markConsumed` / `rewards.partnerRefuse` / query lookup caisse exige :

- session partenaire valide **ou** `rg_admin` ;  
- pour staff/admin marque : le code doit appartenir à un `rewardsCatalogItem.partnerId` **égal** à `account.partnerId` (sauf `rg_admin`) ;  
- **aucun** endpoint public joueur n’expose ces mutations (reject si rôle = user app).

---

## 4. Câblage Convex §5.4 (OP-04…06, OP-F03…05)

Backend **déjà spécifié** dans `ARCHI_REWARDS_PARTENAIRES.md` §5.4 — l’outil est un **client autorisé**, pas une 2ᵉ vérité.

### 4.1 Queries / mutations à exposer (rôles partenaire)

| API | Qui | Comportement |
|-----|-----|--------------|
| `rewards.partnerLookupCode({ code })` | staff / partner_admin / rg_admin | **Lecture seule** : status + titre item + partenaire ; **ne consomme pas** ; pas de solde joueur, pas de €, pas de scores (OP-F08, CA-OP6) |
| `rewards.markConsumed({ code })` | idem | §5.4 → `consumed` ; atomique ; 2ᵉ appel → erreur claire |
| `rewards.partnerRefuse({ code, reason? })` | idem | §5.4 → `partner_refused` / `invalidated` + recrédit ledger `partner_refuse_recredit` (hors earnedThisCycle) |
| `rewards.partnerActionLog.listMine` | staff+ | Dernières actions **de ce** `partnerId` uniquement |

### 4.2 Flow caisse UI

1. Auth → écran Accueil.  
2. Saisie code → `partnerLookupCode`.  
3. Affichage : valide / déjà utilisé / expiré / inconnu / refusé + **libellé cadeau**.  
4. Si status ∈ {`created`, `shown`} et non expiré :  
   - **Oui, donné** → `markConsumed` ;  
   - **Non, rupture** → motif optionnel → `partnerRefuse`.  
5. Si `rg_admin` : étape **« Je confirme »** obligatoire avant Oui/Non (OP-F07, CA-OP8) — double confirmation UI + flag `adminConfirmed: true` côté mutation (reject si `rg_admin` sans flag).  
6. Banner fixe : « Ranked Gym ne rembourse pas le stock ; le cadeau est offert par la marque / la salle. » (OP-F09, CA-OP7).

### 4.3 Invariants anti-triche

- Joueur app : **zéro** bouton / mutation `partnerRefuse` / `markConsumed`.  
- Recrédit **uniquement** via `partnerRefuse` (ou ajustement admin hors outil v0).  
- Stock physique = partenaire (OP-08) — l’outil ne décrémente que le **code** / status, pas un inventaire magasin Ranked Gym.  
- RK-03 : aucune écriture Force / Discipline / entitlements Pro / catalogue depuis cet outil (OP-09).

---

## 5. Logs (OP-A04, OP-F10, RP-F11)

### Table `rewardsPartnerActionLog` (append-only)

| Champ | Type | Notes |
|-------|------|-------|
| `partnerId` | Id | |
| `accountId` | Id | employé / admin |
| `role` | string | snapshot |
| `code` | string | |
| `redemptionId` | Id? | |
| `action` | `"lookup" \| "consume" \| "refuse"` | |
| `result` | `"ok" \| "denied" \| "error"` | + code erreur court |
| `reason` | string? | refus |
| `adminConfirmed` | boolean? | true si rg_admin |
| `createdAt` | number | |
| `ipHash` | string? | optionnel v0 (hash, pas IP claire) |

Rétention : alignée support RP (Product / Juriste ultérieur) — v0 = conserver.

---

## 6. Écrans v0 (miroir OP.3)

| Écran | Contenu | Interdit |
|-------|---------|----------|
| Connexion / invite | E-mail · mdp | Accès anonyme |
| Accueil caisse | Champ code · Vérifier | Scores, boutique joueur |
| Résultat | Statut + libellé cadeau · Oui / Non | Solde pts, €, Force/Discipline |
| Confirmation admin | 2ᵉ étape rg_admin | One-click silencieux |
| Historique | Actions de *ce* partenaire | Autres marques |

---

## 7. Critères d’acceptation (miroir CA-OP)

| ID | Critère archi / Dev |
|----|---------------------|
| CA-OP1 | Sans compte partenaire → pas d’UI ni d’API mutation |
| CA-OP2 | Oui donné sur code valide → `consumed` ; 2ᵉ Oui refusé |
| CA-OP3 | Non rupture → recrédit §5.4 + code mort |
| CA-OP4 | App joueur sans voie de recrédit self-serve |
| CA-OP5 | Origine / vhost ≠ site marketing Ranked Gym |
| CA-OP6 | UI sans Force, Discipline, ligue, € |
| CA-OP7 | Aucun flux paiement stock Ranked Gym |
| CA-OP8 | `rg_admin` exige `adminConfirmed` |
| CA-OP9 | Mode Espace Forme club **hors** v0 |

---

## 8. Lots livraison (après GO Evan sur cette SPEC)

| Lot | Contenu | Dépendance |
|-----|---------|------------|
| **OP-a** | Tables comptes / invite / session ; login ; garde rôles | GO Evan SPEC |
| **OP-b** | `partnerLookupCode` + UI caisse + câblage `markConsumed` / `partnerRefuse` | OP-a + backend RP §5.4 live |
| **OP-c** | Logs + historique partenaire + double confirm `rg_admin` | OP-b |
| **OP-d** | Déploiement VPS 2ᵉ vhost + TLS + CORS | OP-b |

**Pas de Dev** tant que Studio n’a pas le **GO code Evan** après lecture de cette SPEC.

---

## 9. Hors scope / P1 (OP.5)

| Item | Traitement |
|------|------------|
| Mode club **Espace Forme** (multi-postes, badges salle) | **P1** |
| Webhook / pistolet caisse | Hors v0 |
| App mobile partenaire | Hors v0 |
| SSO Google Workspace | Hors v0 |
| Édition catalogue / points depuis l’outil | Interdit |
| Paiement / facturation stock par Ranked Gym | Interdit |
| CGU / contrat marque | Juriste après figement |

---

## 10. Décisions ouvertes (Evan — avant Dev)

1. Confirmer **sous-domaine / domaine** exact du 2ᵉ site (ex. `partners.…`).  
2. Confirmer TTL session (**8 h** / idle **30 min**) ou amender.  
3. **GO code** après lecture de cette SPEC → Studio brief Dev (lots OP-a…).

Studio Manager porte le GO Evan ; Archi n’écrit pas de code.
