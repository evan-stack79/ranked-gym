# Table de décision Prot_Target — spec production

**Règle Prot_Target (spec validée §9)** :

| Condition | Prot_Target g/kg |
|-----------|-------------------|
| PERTE_POIDS **ET** musculation incluse | **2.4** |
| Au moins un sport (`sport_principal` ou `sport_secondaire`) | **1.6** |
| Sinon (sédentaire / AUCUN) | **0.8** |

**Règle Prot_Min (spec §8 — cascade)** :

| Priorité | Condition | Prot_Min g/kg |
|----------|-----------|---------------|
| 1 | Musculation **ET** perte | **2.4** |
| 2 | Musculation **OU** sport collectif | **1.4** |
| 3 | Endurance **OU** cyclisme | **1.2** |
| 4 | Défaut | **0.8** |

## Table exhaustive

| Profil | Objectif | Prot_Min | Prot_Target | Implémentation |
|--------|----------|----------|-------------|----------------|
| Sédentaire | * | 0.8 | 0.8 | Conforme |
| Marche / endurance | * | 1.2 | 1.6 | Conforme |
| Musculation | Maintien / prise | 1.4 | 1.6 | Conforme |
| Musculation | Perte | 2.4 | 2.4 | Conforme |
| Cyclisme | * | 1.2 | 1.6 | Conforme |
| Sport collectif | * | 1.4 | 1.6 | Conforme |
| Force + Endurance | Perte | 2.4 | 2.4 | Conforme |
| Force + Endurance | Maintien / prise | 1.4 | 1.6 | Conforme |
| > 65 ans | * | cascade sport | cascade Prot_Target | Reco UI senior uniquement |

## Ambiguïtés résolues

| # | Point | Statut |
|---|-------|--------|
| A1 | Valeurs Prot_Target | **Résolu** — spec §9 fournit 2.4 / 1.6 / 0.8 |
| A2 | > 65 ans | Pas de modification Prot ; message UI §16 |
| A3 | Marche | Classée endurance → Prot_Min 1.2 |
| A4 | Force + Endurance | Flags OR + cascade Prot_Min ; Prot_Target via §9 |
