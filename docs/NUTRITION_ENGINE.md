# Moteur nutritionnel Ranked Gym — Spécification & conformité

Contrat métier implémenté dans `src/nutrition-engine/`.  
API Edge : `supabase/functions/nutrition-engine/index.ts`.

---

## A. Audit final de la spécification

### Contradictions identifiées (non corrigées silencieusement)

| ID | Section | Problème | Conséquence | Correction minimale proposée |
|----|---------|----------|-------------|----------------------------|
| C1 | Livrables / prompt | Sections A–I complètes absentes du dépôt historique | Coefficients PA IOM documentés dans `constants/iom.ts` ; **Prot_Target** selon spec §9 : 2.4 (cut+muscu) / 1.6 (sport) / 0.8 (sédentaire) |
| C2 | Règle 6 — Lipides | `Lip_Target_Kcal = Target × 0.25` peut être **<** `Lip_Min` (ex. 130 kg → 585 kcal lipides > 25 % d’une cible basse) | Étape 2 Waterfall bloquée | `Lip_Target_g = max(Lip_Min_g, Target_Kcal × 0.25 / 9)` |
| C3 | Règle 6 — Glucides | `Gluc_Target = 8 g/kg` (endurance) vs « tout le reliquat aux glucides » | Le reliquat peut dépasser 8 g/kg | Comportement mathématique autorisé : `Gluc_Target` informatif ; l’étape 3 assigne **100 %** du reliquat (pas de plafond) |
| C4 | Cas limite / test 5 | Forcer lipides à 585 kcal peut rendre `Target < BCMR` | Moteur doit rejeter avant allocation | Testé : `ERR_TARGET_BELOW_BCMR` si `Target < BCMR` — jamais de remplacement silencieux |
| C5 | App existante | ~~`nutritionActivity.ts` ajoute encore steps/workout kcal à la cible~~ | Résolu : UI branchée sur `runNutritionEngine()` via `getNutritionTarget()` ; `activityBonus` toujours 0 | — |

### Cohérence vérifiée

- EER → Target (maintien / déficit / surplus) : cohérent.
- BCMR = somme planchers × facteurs Atwater : cohérent.
- Waterfall séquentiel Prot → Lip → Gluc : cohérent avec conservation énergétique (tests).
- Sports combinés : flags OR + cascade priorité protéines (pas double comptage) : cohérent.
- Recommandations UI isolées des macros : cohérent (testé).

---

## A2. Nutrition Engine V2 — revue glucidique (politique produit)

### [SCIENCE]
- Plages de référence fréquentes : protéines sport ~1,6–2,2 g/kg ; lipides ~20–35 % des kcal ; glucides endurance souvent ~6–10 g/kg selon charge.
- **Aucune** source ne fixe un plafond glucidique médical universel (ex. 7 g/kg) pour la musculation.
- **Aucune** preuve que tout surplus calorique doive être converti en glucides.

### [CHOIX PRODUIT]
| Constante | Valeur | Sens |
|-----------|--------|------|
| `CARB_REVIEW_THRESHOLD_G_PER_KG` | **7,0** | Seuil de **revue algorithmique**, **pas** une limite médicale |
| `LIP_MAX_PCT` | **0,35** | Borne haute de redistribution lipidique |
| `PROTEIN_MAX_G_PER_KG` | **2,2** | Borne haute d’upgrade protéique en redistrib (n’écrase pas Prot_Target 2,4 cut+muscu) |

### [ALGORITHME]
1. Waterfall **V1 inchangé** (EER → Target → BCMR → hard stop → Prot → Lip 25 % → reliquat glucides).
2. Post-pass **V2** : si `hasEndurance` (endurance, cyclisme, **ou force+endurance**) → **pas** de redistrib ; sinon si `glucides_g/kg > 7` :
   - R1 : excédent → lipides jusqu’à 35 % Target ;
   - R2 : excédent restant → protéines jusqu’à `max(Prot_Target, 2,2 g/kg)` ;
   - si encore `> 7 g/kg` → FLAG `CARB_REVIEW_REMAINING_AFTER_LIMITS` et **stop** (macros figées).
3. Sérialisation : UI à 1 décimale (`serializeEngineResult`) ; API macros entières (`formatApiPayload`).
4. Réconciliation d’arrondi API (sérialisation seule) : après `Math.round` indépendant, ajuster **une** macro (glucides prioritaires) pour coller à `Target_Kcal` quand c’est possible avec Atwater (4/9/4). Si impossible (delta ∉ 4ℤ et ∉ 9ℤ), meilleure approximation — tolérance max documentée `API_INTEGER_ENERGY_TOLERANCE_KCAL = 2`.
5. Flags exposés dans `allocation_flags` (API + UI) — informatifs, non médicaux ; **non** modifiés par la réconciliation API.

Fichiers : `constants/policy.ts`, `redistribute.ts`, branchement + `reconcileApiIntegerMacros` dans `engine.ts`.

---

## B. Schéma de données validé

### Entrée (`NutritionEngineInput`)

| Champ | Type | Validation |
|-------|------|------------|
| `sex` | `'male' \| 'female'` | requis |
| `age` | number | 18–120 |
| `weight_kg` | number | 30–250 |
| `height_m` | number | 1–2.5 |
| `activity` | 1 \| 2 \| 3 \| 4 | entier IOM PA |
| `goal` | `maintain \| cut \| bulk` | requis |
| `deficit_kcal` | number | 0–2000 |
| `surplus_kcal` | number | 0–1000 |
| `sport_principal` | string \| null | id sport |
| `sport_secondaire` | string \| null | id sport |
| `duration_h` | number | 0–10 (recommandations) |
| `effort_fluid_loss_l` | number | ≥ 0 (recommandations) |

**Interdit** : `burned_calories`, `steps`, `watch_kcal`, toute source d’activité dynamique.

### Sortie succès

```json
{
  "ok": true,
  "data": {
    "eer_kcal": 2850,
    "target_kcal": 2550,
    "bcmr_kcal": 1833,
    "kcal_dispo": 717,
    "proteines_g": 312,
    "lipides_g": 70.8,
    "glucides_g": 95.2,
    "proteines_kcal": 1248,
    "lipides_kcal": 637,
    "glucides_kcal": 381,
    "constraints": { "prot_min_g": 312, "…": "…" },
    "recommendations": ["…"]
  }
}
```

### Sortie erreur BCMR

```json
{
  "ok": false,
  "error": {
    "code": "ERR_TARGET_BELOW_BCMR",
    "message": "La cible calorique est inférieure au BCMR…",
    "details": { "target_kcal": 1832, "bcmr_kcal": 1833 }
  }
}
```

HTTP **422**.

---

## C. Algorithme définitif

```
1. VALIDATE(input)
2. EER ← IOM(sex, age, weight, height, PA[activity])
3. Target ← EER | EER - deficit | EER + surplus
4. flags ← sport_principal ∪ sport_secondaire
5. constraints ← planchers/cibles (cascade prot, endurance gluc, lip 0.5 g/kg)
6. BCMR ← Prot_Min×4 + Lip_Min×9 + Gluc_Min×4
7. IF Target < BCMR → HTTP 422 ERR_TARGET_BELOW_BCMR
8. Kcal_Dispo ← Target - BCMR
9. Waterfall V1 :
   a. Prot : min → target (4 kcal/g)
   b. Lip  : min → max(min, Target×0.25/9) (9 kcal/g)
   c. Gluc : + tout reliquat / 4
10. Post-pass V2 (non-endurance, seuil produit 7 g/kg) — voir §A2
11. ASSERT |macros_kcal - Target| ≤ 3 (floats)
12. recommendations ← UI only (âge, durée, perte fluide)
13. SERIALIZE UI (1 décimale) / API (entiers + réconciliation Atwater éventuelle)
```

---

## D. Implémentation

| Module | Rôle |
|--------|------|
| `constants/iom.ts` | Équations & PA IOM |
| `eer.ts` | EER + target calorique |
| `sportConstraints.ts` | Planchers/cibles sport + objectif |
| `bcmr.ts` | BCMR & Atwater |
| `waterfall.ts` | Allocation séquentielle |
| `recommendations.ts` | Messages UI |
| `validation.ts` | Entrées strictes |
| `engine.ts` | Orchestration + API helper |
| `engine.test.ts` | Tests Vitest |

---

## E. Gestion des erreurs

| Code | HTTP | Déclencheur |
|------|------|-------------|
| `ERR_INVALID_AGE` | 400 | âge ∉ [18,120] |
| `ERR_INVALID_WEIGHT` | 400 | poids ∉ [30,250] |
| `ERR_INVALID_HEIGHT` | 400 | taille ∉ [1,2.5] |
| `ERR_INVALID_ACTIVITY` | 400 | activité ∉ {1,2,3,4} |
| `ERR_INVALID_DEFICIT` | 400 | déficit ∉ [0,2000] |
| `ERR_INVALID_SURPLUS` | 400 | surplus ∉ [0,1000] |
| `ERR_INVALID_DURATION` | 400 | durée ∉ [0,10] |
| `ERR_INVALID_FLUID_LOSS` | 400 | perte < 0 |
| `ERR_TARGET_BELOW_BCMR` | **422** | Target < BCMR |
| `ERR_ENERGY_CONSERVATION` | 500 | écart > tolérance (bug interne) |

---

## F. Tests unitaires

Exécution : `npm test`

- EER IOM (homme, PA niveau 3)
- Target = BCMR → succès aux planchers
- Target = BCMR − 1 → 422
- Target = BCMR + 20 → +5 g glucides (profil 50 kg sans sport)
- Musculation + cut → Prot_Min 2.4 g/kg
- Endurance → Gluc_Min 6 g/kg
- 130 kg lipides 65 g & BCMR gate
- Conservation énergétique
- Validation âge
- Recommandations n’altèrent pas les macros

---

## G. Tests cas limites

| Cas | Attendu |
|-----|---------|
| `Target = BCMR` | OK, macros = planchers |
| `Target = BCMR + 20` | OK, reliquat Waterfall (souvent glucides) |
| `Target = BCMR - 1` | 422 `ERR_TARGET_BELOW_BCMR` |
| Non-endurance | `Gluc_Min = 0` autorisé |
| 130 kg + muscu cut | `Lip_Min = 65 g` ; rejet si Target < BCMR |

---

## H. Exemple requête / réponse API

**POST** `/functions/v1/nutrition-engine`

```json
{
  "sex": "male",
  "age": 28,
  "weight_kg": 82,
  "height_m": 1.78,
  "activity": 3,
  "goal": "cut",
  "deficit_kcal": 400,
  "surplus_kcal": 0,
  "sport_principal": "musculation",
  "sport_secondaire": "football",
  "duration_h": 1.5,
  "effort_fluid_loss_l": 0.8
}
```

Réponse 200 (extrait) :

```json
{
  "ok": true,
  "data": {
    "eer_kcal": 2912,
    "target_kcal": 2512,
    "bcmr_kcal": 918,
    "proteines_g": 196.8,
    "lipides_g": 69.8,
    "glucides_g": 248.5,
    "recommendations": [
      "Hydratation effort (~1.5 h) : vise 750–1000 ml…"
    ]
  }
}
```

---

## I. Rapport de conformité

| Règle | Implémentée | Testée | Conforme |
|-------|-------------|--------|----------|
| EER IOM + PA uniquement | ✅ | ✅ | ✅ |
| Pas de calories montre / burned | ✅ | ✅ | ✅ |
| Target maintien / déficit / surplus | ✅ | ✅ | ✅ |
| Séparation Min vs Target | ✅ Prot_Target 2.4 / 1.6 / 0.8 | ✅ | ✅ |
| Sports combinés (max pertinent) | ✅ | ✅ | ✅ |
| BCMR + gate 422 | ✅ | ✅ | ✅ |
| Waterfall Prot → Lip → Gluc | ✅ | ✅ | ✅ |
| Post-pass V2 (non-endurance) | ✅ | ✅ | ✅ |
| Conservation énergétique (floats) | ✅ | ✅ | ✅ |
| Conservation API entiers (réconciliation) | ✅ | ✅ | ✅\* |
| Recommandations UI isolées | ✅ | ✅ | ✅ |
| Validation entrées stricte | ✅ | ✅ | ✅ |
| Arrondis uniquement à la sérialisation | ✅ | ✅ | ✅ |
| UI sans steps/workout/activityBonus | ✅ (C5 résolu) | ✅ | ✅ |

\* Si le delta post-`Math.round` n’est multiple ni de 4 ni de 9, une conservation **exacte** est impossible en n’ajustant qu’une macro Atwater ; résidu ≤ `API_INTEGER_ENERGY_TOLERANCE_KCAL` (2).

---

## Équations IOM (référence)

**Hommes (≥19 ans)**  
`EER = 662 − (9.53 × âge) + PA × (15.91 × poids_kg + 539.6 × taille_m)`

**Femmes (≥19 ans)**  
`EER = 354 − (6.91 × âge) + PA × (9.36 × poids_kg + 726 × taille_m)`

**PA** — Hommes : `[1.00, 1.11, 1.25, 1.48]` · Femmes : `[1.00, 1.12, 1.27, 1.45]` (niveaux 1–4).

Source : Dietary Reference Intakes for Energy (IOM/NAS, 2005).
