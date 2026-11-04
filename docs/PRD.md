# PRD — Ranked Gym (sections Product)

Statut global : sections livrées au fil des briefs Studio. Pas de code. Merge / GO code = Evan uniquement.
Sources liées : `SPEC_RANKED.md` · fiche canvas récompenses partenaires (MI, 4/11/2026) · RK-03 · alerte Juriste 4/11/2026.

---

## RP — Récompenses partenaires (v0 Product)

**Statut :** **RP v0.1 FIGÉ** (Evan 4/11/2026 : « (A) Oui, GO Archi — pas de code »). Catalogue identique free/Pro. Brief Archi = Studio. **Pas de code** Product. CGU rewards = Juriste après ce figement.
**Hors Force / Discipline compétitifs :** la boutique cadeaux est un **canal séparé** (ne pas mélanger UI scores / ligues et catalogue).
**Alignement :** RK-03 (zéro P2W) · soft reset / saison 6–8 sem (`SPEC_RANKED` §4.4) · Pro = **cosmétiques / confort uniquement** (pas d’avantage catalogue cadeaux).

### RP.0 Objectif
Les marques offrent des cadeaux. Ranked Gym attribue des **points d’effort** quand une **Discipline est validée**. Le joueur échange des points contre un **code unique** à la caisse partenaire. Ranked Gym n’achète pas le stock.

### RP.1 Règles points (figées)
| ID | Règle |
|----|--------|
| RP-01 | Source des points = **Discipline validée** (séance / check-in validé selon règles Discipline existantes) **ou** objectif simple de semaine validé — **pas** minutes d’entraînement seules. |
| RP-02 | **Même taux** de gain gratuit / Ranked Pro. |
| RP-03 | **Même plafond** gratuit / Pro (journalier et / ou saison). Jamais plafond plus haut pour Pro. Jamais ×2 / multiplicateur payant. |
| RP-04 | Attribution **après** validation anti-triche Discipline (alignée règles séances validées ; pas de points sur séance refusée / frauduleuse). |
| RP-05 | **Reset** solde points utilisables = **fin de saison / ligue** (cycle soft reset ~6–8 sem), **annoncé à l’avance**. Pas de stock infini multi-saisons sans règle explicite ultérieure. |
| RP-06 | Échange = catalogue in-app → **code à usage unique** → caisse partenaire. 1 code = 1 redemption. |
| RP-07 | **Séparation stricte** : écrans / flux Force, Discipline, ligues **≠** boutique cadeaux (pas de CTA Pass à côté d’un score ; pas de score dans la boutique). |
| RP-08 | Lots de **fin de saison** : selon le **rang en ligue**, **mêmes règles** pour tous (gratuit = Pro). Pro ne change pas le barème de lots. |
| RP-09 | **Catalogue cadeaux identique** gratuit et Pro (mêmes items, mêmes coûts en points, mêmes dates de dispo). **Interdit** : accès plus tôt, aperçu exclusif, lots « Pro only » — recrée un lien paiement↔cadeau (alerte Juriste 4/11). |
| RP-10 | **Pas d’achat de points** (ni IAP « pack de points », ni conversion euros→points). |
| RP-11 | **Pas de hasard** dans l’attribution des cadeaux / codes (pas de loot box, tirage, roulette). Échange déterministe points→item. |
| RP-12 | Points = **sans valeur monétaire**, **non remboursables**, **non convertibles** (pas d’équivalent €), **non cessibles** / non transférables / non revendables entre comptes (cadrage Juriste — à reprendre en CGU plus tard). |
| RP-13 | Codes **déjà générés** avant un reset restent **valables** jusqu’à consommation / expiration propre du code (le reset porte sur le **solde** non échangé, pas sur les codes émis). |
| RP-14 | Si un partenaire **refuse un code encore valide** (bug caisse, stock) → **recrédit** des points au joueur + invalidation du code — pas de perte sèche. |

### RP.2 Gratuit vs Ranked Pro (9,99 €) — figé (Juriste 4/11)
| Capacité | Gratuit | Ranked Pro |
|----------|---------|------------|
| Gagner des points | Oui, même taux | Oui, même taux |
| Plafond j / saison | Identique | Identique |
| Force / Discipline / ligues | Identique | Identique (jamais boosté) |
| Catalogue cadeaux | **Identique** | **Identique** (pas d’early access / exclusif) |
| Cosmétiques / badges / confort | Base | Skins, badges, confort UI |
| Lots fin de saison | Selon rang | Selon rang (mêmes règles) |

**Interdit (RK-03 + Juriste) :** ×2 Pro · plafond Pro plus haut · early access / aperçu exclusif catalogue · points qui boostent Force/Discipline · achat de points · hasard / loot box · prix « secrets » Pro qui touchent rang ou lots.

### RP.3 Catalogue v0 (3–5 catégories + barèmes d’exemple)
Barèmes = **ordres de grandeur Product** pour caler « une semaine régulière ≈ un petit cadeau ». Chiffres à affiner avec stock marques / Archi (économie) — **pas** formules scientifiques (hors Vérificateur). Catalogue **unique** pour free et Pro (RP-09).

| ID cat. | Catégorie | Exemple | Points (exemple) |
|---------|-----------|---------|------------------|
| RP-CAT-01 | Boisson / café | Café, boisson, shaker offert | ~150 |
| RP-CAT-02 | Snack / barre | Barre protéinée, gel | ~90–120 |
| RP-CAT-03 | Complément | Échantillon / sachet recovery | ~200–400 |
| RP-CAT-04 | Salle / cours | Séance découverte ou réduction | ~250–500 |
| RP-CAT-05 | Équipement léger | Bande, shaker, goodies marque | ~300–600 |

**Plafond d’exemple v0 (à confirmer Archi + Evan avant code) :** ex. **50 pts / jour** et/ou plafond saison dérivé du cycle Discipline — **identique** gratuit / Pro (RP-03).

### RP.4 Exigences fonctionnelles numérotées (Archi/Dev)
**Note process :** si un partenaire refuse un code **encore valide** dans le délai → **recrédit** des points (RP-14 / RP-F12).

1. **RP-F01** — Compteur « points partenaires » distinct du score Force / Discipline / XP cosmétique.
2. **RP-F02** — Crédit points uniquement sur événement Discipline **validée** (hook post-validation séance / objectif semaine) ; jamais sur durée seule.
3. **RP-F03** — Appliquer plafond journalier (et saison si défini) **avant** crédit ; même config free/Pro.
4. **RP-F04** — Catalogue : 3–5 catégories v0 ; item = titre, catégorie, coût points, partenaire, stock logique, actif oui/non ; **même feed** free/Pro (pas de flag early/exclusive Pro).
5. **RP-F05** — Checkout points → génération **code unique** one-shot ; état : créé / montré / consommé / expiré / refusé-partenaire ; pas de réutilisation.
6. **RP-F06** — Pro = **cosmétiques / badges / confort hors catalogue lots** seulement. **Interdit** côté Pro : champs `pointMultiplier` / `capBonus` (ou équivalent). **Pas** d’early access / aperçu exclusif catalogue (voir RP-09) — le catalogue lots est hors différenciation Pro.
7. **RP-F07** — Soft reset fin de saison/ligue **annoncé** : solde points non échangé remis (RP-05) ; codes déjà générés **restent valables** (RP-13) ; Force/Discipline inchangés (SPEC_RANKED).
8. **RP-F08** — Lots saison : table rang → lot ; évaluation **identique** free/Pro.
9. **RP-F09** — Navigation : entrée boutique **hors** hub scores Force/Discipline — validation anti-P2W PM+Studio avant merge UI.
10. **RP-F10** — 18+ si redemption en magasin l’exige — à confirmer Juriste en CGU.
11. **RP-F11** — Logs redemption (code scanné / utilisé / refusé partenaire) pour mesure + support.
12. **RP-F12** — Flux **recrédit** si partenaire refuse un code encore valide (RP-14) : points rendus, code invalidé, log motif.
13. **RP-F13** — Pas d’IAP ni écran d’achat de points ; pas de mécanique aléatoire sur les cadeaux (RP-10, RP-11).
14. **RP-F14** — Solde / points : pas d’affichage « équivalent € » ; pas de remboursement cash ; pas de conversion ; pas de transfert entre comptes (RP-12).

### RP.5 Cadre Juriste (à reprendre plus tard en CGU — pas dans ce livrable)
À écrire dans les CGU rewards **après** figement PRD (GO Evan + Studio). Product fige déjà le fond ici :
- Points **sans valeur monétaire**, **non remboursables**, **non convertibles**, **non cessibles** / non transférables / non revendables.
- **Reset annoncé** ; codes déjà générés restent valables.
- **Recrédit** si partenaire refuse un code valide.
- **Pas de hasard** (pas de jeu d’argent / loot box).
- **Pas d’achat de points**.
- Catalogue **identique** free/Pro (pas de lien paiement↔lot).
- Pro = cosmétiques / confort seulement.

**Pas de CGU longue** tant que RP n’est pas figé.

### RP.6 Hors scope v0
- Liste concrète marques FR (MI / Studio).
- Rédaction CGU rewards complète (Juriste, après figement).
- Achat de stock par Ranked Gym.
- Points sur minutes GPS / cardio seules.
- Multiplicateurs payants, early access catalogue, battle pass qui booste les points.
- Fusion UI boutique ↔ écrans Force/Discipline.

### RP.7 Calculs / validation
- **Pas de formule scientifique** à valider par le Vérificateur pour ce lot (barèmes = Product / économie).
- **Validation obligatoire avant code :** revue **anti-P2W** (PM + Studio) + relecture Juriste sur RP-09…RP-14.
- Plafond chiffré final (50 pts/j ou autre) = **GO Evan** après proposition Archi.

### RP.8 Critères d’acceptation (après code, hors ce livrable)
- CA-RP1 : Compte Pro et gratuit avec même activité Discipline → **même** points gagnés et **même** plafond atteint.
- CA-RP2 : Impossible d’acheter des points, un multiplicateur, ou un plafond plus haut.
- CA-RP3 : Code redemption à usage unique ; 2ᵉ scan / réutilisation refusée.
- CA-RP4 : Fin de saison → solde reset selon RP-05 ; codes déjà émis restent utilisables (RP-13).
- CA-RP5 : Aucun CTA Pass / coins sur écran score Force ou Discipline via ce lot.
- CA-RP6 : Catalogue v0 expose au moins 3 catégories parmi RP-CAT-01…05 ; **même catalogue** free et Pro (CA-RP9).
- CA-RP7 : Refus partenaire sur code valide → recrédit points (RP-14).
- CA-RP8 : Aucune mécanique aléatoire sur l’attribution d’un cadeau.
- CA-RP9 : Aucun item / date de dispo réservé Pro dans le catalogue cadeaux.

### RP.9 Références
- Fiche MI : [Ranked Gym — récompenses partenaires](https://cursor.com/canvas/store-aa9032a9-934c-4804-8de3-398def72b0d6/81a03291-cfaf-4211-b290-309041c56a47)
- `SPEC_RANKED.md` (RK-03, Discipline, soft reset)
- Alerte Juriste 4/11/2026 : catalogue identique ; Pro cosmétique only

---

## OP — Outil partenaire (caisse marques)

**Statut :** GO Evan 4/11/2026 via Studio Manager — lots OP-a/b/c (+ prep OP-d) en code.  
**Source de vérité :** `docs/ARCHI_OUTIL_PARTENAIRE.md` · `docs/ARCHI_REWARDS_PARTENAIRES.md` §5.4 · `docs/PARTNER_TOOL_DEPLOY.md`.

### OP.0
Page web privée hors app joueur : code cadeau → **Oui, donné** (`rewards.markConsumed`) / **Non, rupture** (`rewards.partnerRefuse` + recrédit). Joueur ne se recrédit pas.

### OP.1 Décisions
OP-01…09 : web privée · VPS 2ᵉ vhost · auth partenaire · flow caisse · markConsumed / partnerRefuse · anti-triche · stock = partenaire · RK-03 inchangé.

### Critères CA-OP1…9
Voir `docs/ARCHI_OUTIL_PARTENAIRE.md` §7. App : `partner-tool/` (hors bundle Capacitor).
