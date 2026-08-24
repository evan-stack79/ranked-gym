# Table de décision Prot_Target — audit spec validée

**Source de vérité** : règles métier impératives du contrat (sections fournies au prompt).  
**Constat** : la spec définit explicitement **Prot_Min** (g/kg) et mentionne **Prot_Target** comme champ distinct, mais **ne fournit aucune valeur numérique pour Prot_Target** (sections A–I complètes absentes du dépôt).

## Règle Prot_Min (spec — cascade, pas de double comptage)

| Priorité | Condition | Prot_Min g/kg |
|----------|-----------|---------------|
| 1 | Musculation incluse **ET** perte de poids (`cut`) | **2.4** |
| 2 | Musculation **OU** sport collectif | **1.4** |
| 3 | Endurance / cyclisme | **1.2** |
| 4 | Défaut (sédentaire, marche seule sans flag endurance*, yoga, etc.) | **0.8** |

\* « Marche » est classée **endurance** dans le moteur (`marche` ∈ ENDURANCE_IDS) → Prot_Min = **1.2**, pas 0.8.

## Prot_Target — table exhaustive demandée

| Profil / sport | Objectif | Prot_Min (spec) | Prot_Target (spec) | Décision implémentation |
|----------------|----------|-----------------|--------------------|-------------------------|
| Sédentaire (aucun sport) | Maintien | 0.8 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Sédentaire | Perte | 0.8 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Sédentaire | Prise | 0.8 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Marche | Maintien | 1.2 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Marche | Perte | 1.2 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Marche | Prise | 1.2 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Musculation | Maintien | 1.4 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Musculation | Perte | **2.4** | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Musculation | Prise | 1.4 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Endurance (course, natation…) | * | 1.2 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Cyclisme (`velo`, VTT…) | * | 1.2 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Sport collectif | * | 1.4 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Force + Endurance (ex. muscu + vélo) | Maintien | 1.4 (priorité muscu) | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Force + Endurance | Perte | **2.4** (priorité muscu+cut) | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Force + Endurance | Prise | 1.4 | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` |
| Personne > 65 ans | * | *(même cascade sport)* | **NON SPÉCIFIÉ** | `Prot_Target = Prot_Min` ; message UI senior uniquement |

## Ambiguïtés signalées (aucune règle inventée)

| # | Combinaison | Problème |
|---|-------------|----------|
| A1 | **Prot_Target numérique** | Absent de la spec validée → impossible de distinguer Min et Target sans inventer un coefficient |
| A2 | **> 65 ans** | Recommandation UI « senior » mentionnée ; **aucune** modification Prot_Min / Prot_Target dans la spec |
| A3 | **Marche vs sédentaire** | « Marche » n’est pas une catégorie PA IOM ; traitée comme sport endurance si sélectionnée |
| A4 | **Force + Endurance** | Spec : cumul = contraintes max pertinentes via cascade Prot_Min ; pas de règle Prot_Target supérieure au Min |

## Conséquence Waterfall

Tant que `Prot_Target = Prot_Min`, **l’étape 1 Waterfall n’alloue aucun kcal supplémentaire aux protéines** : le reliquat `Kcal_Dispo` va aux lipides (étape 2) puis glucides (étape 3). C’est **mathématiquement conforme** à la spec partielle.

## Action requise pour finaliser Prot_Target au-delà du Min

Fournir dans la spec complète un tableau `Prot_Target g/kg` (ou formules) par profil/objectif. Sans cela, toute valeur > Prot_Min serait **inventée** (interdit).
