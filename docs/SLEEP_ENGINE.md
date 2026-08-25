# Sleep Engine V1.0 — Spécification & conformité

Moteur isolé dans `src/sleep-engine/`.  
API Edge : `supabase/functions/sleep-engine/index.ts`.

**Aucun couplage** avec `nutrition-engine` ni avec les calories d’activité.

---

## Architecture

```
UI / API
  ↓
runSleepEngine(input)     ← pur, déterministe
  ↓
validation → quantity → regularity (circulaire) → efficiency → catch-up
  ↓
recommendations / warnings  (isolés des métriques)
  ↓
SleepEngineResult
```

---

## Règles implémentées

| Domaine | Règle |
|---------|--------|
| Quantité | 7 ≤ TST ≤ 9 → `optimal` ; TST < 7 → `deficit` ; TST > 9 → `excess` |
| Régularité | σ circulaire (minutes) sur couchers/levers ; **pas de classification clinique** |
| Efficacité | SE = TST/TIB × 100 ; flag informatif vs seuil **85 %** (contexte restriction TIB) |
| Catch-up | moyenne workdays < 7 h → `recoveryNeeded` + texte informatif |
| Validation | timestamps, TST ≥ 0, TST ≤ TIB, historique pour dispersion |
| Minuit | représentation circulaire 24 h (23:50↔00:10 ≈ 20 min) |

## Règles volontairement exclues

| Exclusion | Raison |
|-----------|--------|
| Score scientifique 0–100 | Classification discrète uniquement ; pas de score clinique inventé |
| Classification « régulier / irrégulier » | Aucun seuil de variabilité scientifiquement justifié fourni |
| Restriction automatique du TIB / CBT-I | Risque thérapeutique ; stub expérimental **désactivé** (`experimentalRestriction.ts`) |
| `TIB_ABSOLUTE_MINIMUM = 5.0` | Non implémenté — non justifié pour une app grand public |
| REM / Deep / Light | Non fiables pour le score V1 ; ignorés |
| Diagnostics (apnée, insomnie, trouble circadien) | Interdits ; warnings d’orientation professionnelle seulement |
| Calories activité / `burned_calories` | Rejetés sur l’API Sleep |

---

## Seuil 85 % — documentation

Le flag `aboveClinicalTibRestrictionThreshold85` compare SE au **85 %** issu du
contexte clinique de **restriction du temps au lit**.  
Ce n’est **pas** une définition universelle de « bonne qualité du sommeil ».

---

## Régularité — minimum d’échantillons

`MIN_REGULARITY_SAMPLES = 3` (choix d’ingénierie pour une dispersion informative).  
Ce n’est **pas** un seuil clinique de « bonne régularité ».

---

## API

**POST** `/functions/v1/sleep-engine`

```json
{
  "bedtime": "23:00",
  "waketime": "07:00",
  "tstHours": 8,
  "historicalBedtimes": ["23:00", "23:10"],
  "historicalWaketimes": ["07:00", "07:05"],
  "workdayTstHours": [6.5, 6.0, 7.0],
  "currentTibHours": 8.5
}
```

Succès : `{ "status": "SUCCESS", "scientific_status": "optimal", "metrics": {…}, "recommendations": [], "warnings": [] }`  
Erreur : `{ "status": "ERROR", "error_code": "…", "message": "…" }`

---

## Déploiement

```bash
supabase functions deploy sleep-engine
```

Ne pas déployer `nutrition-engine` via cette commande — moteurs séparés.
