# Product Marketing Context

**Document version:** v3
**Last updated:** 2026-09-28

> Draft auto-généré depuis le repo Ranked Gym, enrichi par Evan. Sections marquées *[à confirmer]* ou *[gap]* attendent encore ta validation.

## Product Overview
**One-liner:** Tous tes sports. Une seule progression.
**What it does:** Ranked Gym est une app mobile-first (PWA + Capacitor) qui réunit entraînement, nutrition et récupération dans un même parcours gamifié — ranks, XP, streaks — avec une couche sociale autour des salles (Lobby / check-in) et un moment de share post-séance (Pump Check).
**Product category:** App fitness / suivi d’entraînement gamifié · réseau social sportif
**Product type:** Consumer mobile app (SaaS B2C) — bêta privée sur invitation
**Business model:** Freemium — **6,99 € / mois** pour Premium

### Free vs Premium
**Gratuit :**
- Compteur / suivi calorique
- Suivi hydratation
- Entraînements (logging séances)

**Premium (6,99 €/mois) :**
- Scanner code-barres aliments
- Analyse d’aliments par IA
- Parcours objectifs poussé à fond / plus efficace *[périmètre exact à affiner]*

**À décider :**
- BPM / fréquence cardiaque (caméra) — gratuit ou Premium ? *[ouvert]*

## Target Audience
**Target companies:** N/A (B2C)
**Decision-makers:** L’athlète / pratiquant lui-même
**Primary use case:** Suivre et faire progresser son sport au quotidien sans jongler entre plusieurs apps (train + nutri + sommeil), avec une motivation de rang / série et un lien social en salle
**Jobs to be done:**
- Logger et progresser sur mon (mes) sport(s) au même endroit
- Voir ma progression (XP, rank, streak) pour rester régulier
- Me connecter à d’autres pratiquants autour de ma salle / mon spot
**Use cases:**
- Séance muscu / force avec exercices, repos, PR, Pump Check
- Course, sports co, combat, cyclisme, CrossFit, fitness (disciplines multi-sport)
- Suivi calories / macros + hydratation
- Suivi sommeil / récupération
- Check-in Lobby près d’une salle (Google Places) + membres présents
- Partage d’une carte “victoire” post-séance

## Personas
Produit B2C — personas d’usage (pas d’achat multi-stakeholders) :

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Pratiquant régulier (muscu / hybride) | Progression, régularité, stats crédibles | Apps fragmentées + motivation qui chute | Une progression unique (rank/XP) + train/nutri/récup |
| Social gym-goer | Qui est en salle, vibe, partage | Salles anonymes, peu de lien entre sessions | Lobby / check-in + feed + Pump Check |
| Multi-sport | Un seul endroit pour force + endurance + co | Stack d’apps (MyFitnessPal / Cal AI + Gym Rank / logger…) | « Tous tes sports » dans Ranked Gym |

## Problems & Pain Points
**Core problem:** Les pratiquants doivent empiler plusieurs apps (nutrition d’un côté, ranks / salle de l’autre) pour s’entraîner, manger, récupérer et rester motivés — et rien ne pousse vraiment leurs objectifs à fond.
**Why alternatives fall short:**
- Trackers nutrition (MyFitnessPal, Cal AI…) : bons pour logger les repas / calories, mais hors entraînement gamifié, hors Lobby salle, hors progression “ranked”
- Apps “ranked / gym rank” (Gym Rank et équivalents) : misent sur le classement / social salle, mais pas sur un parcours objectifs train + nutri + récup unifié
- Stack multi-apps : contexte et motivation éclatés, tu ne restes pas centré sur ton objectif
**What it costs them:** Friction quotidienne, abandon de tracking, objectifs flous, motivation qui tombe
**Emotional tension:** Se sentir seul en salle, stagner sans feedback, culpabilité quand la série casse, impression de “faire des trucs” sans progresser vraiment

## Competitive Landscape
**Direct:**
- Nutrition / calories : **MyFitnessPal**, **Cal AI**, et apps similaires — fort sur le food logging / IA repas, faible sur train gamifié + ranks + social salle
- Ranked / gym social : **Gym Rank** et apps du même type — fort sur classement / vibe salle, faible sur nutrition + récup + objectifs poussés à fond dans un seul parcours
**Secondary:** Loggers muscu (Hevy, Strong…) + Strava + carnet — falls short because you still juggle pieces and lack a single ranked progression tied to goals
**Indirect:** Coach perso, “juste y aller” sans tracker — falls short on daily accountability and visible progress

## Differentiation
**Key differentiators:**
- Freemium clair : gratuit = calories + hydratation + entraînements ; Premium **6,99 €/mois** = scanner code-barres + analyse aliments IA (+ parcours objectifs poussé)
- Positionnement “rank / arène” : ranks Bronze→Légende avec titres (“Recrue de la Fonte”, “Légende Vivante”…)
- Unification entraînement + nutrition + sommeil (là où MFP/Cal AI et Gym Rank restent chacun d’un côté)
- Multi-disciplines (pas muscu-only)
- Lobby géolocalisé (spots proches + check-in)
- Pump Check (carte photo post-séance partageable)
- Brand dark crimson + panthère, ton FR tutoiement “Hero & Arena”
**How we do it differently:** Une seule progression (XP/rank/streak) branchée sur train + nutri + récup, pas un logger calories ou un classement salle isolé ; le paywall accélère la nutrition (scan + IA) sans bloquer le cœur train/calories
**Why that's better:** Tu démarres gratuit ; tu payes quand tu veux logger la bouffe plus vite et pousser tes objectifs à fond
**Why customers choose us:** *[gap — pas encore de verbatims clients]* — hypothèse : “enfin train + nutri + ranks au même endroit”

## Objections
| Objection | Response |
|-----------|----------|
| « Encore une app fitness » | Une progression pour tous tes sports — train, nutri, récup au même endroit, pas un logger de plus |
| « J’ai déjà MyFitnessPal / Cal AI » | Tu logges les repas ; ici tu progresses aussi en salle, en rank, et sur ton objectif global |
| « Gym Rank / les apps ranked font déjà ça » | Le classement ne suffit pas — on couple ranks + nutrition + récup pour pousser tes objectifs |
| « Pourquoi payer 6,99 € ? » | Gratuit = calories, eau, entraînements. Premium = scanner code-barres + analyse IA pour logger plus vite et pousser tes objectifs |
| « C’est fermé / bêta » | Oui : bêta privée sur invitation pour soigner l’expérience avant une ouverture plus large |
| « Et ma vie privée en salle ? » | Mode Furtif (Stealth) : masque ta localisation dans le feed |

**Anti-persona:** Quelqu’un qui veut uniquement un logger calories minimal (sans ranks / social) ; ou un classement salle pur sans suivi nutrition/objectifs ; ou un tableau Excel ultra-minimal

## Switching Dynamics
**Push:** Fatigué de MyFitnessPal/Cal AI d’un côté et d’une app ranked/salle de l’autre ; objectifs pas vraiment poussés
**Pull:** Rank + nutri + récup unifiés ; Premium 6,99 € pour un parcours objectifs sérieux ; Lobby + Pump Check
**Habit:** Routine déjà ancrée dans MFP / Cal AI / Gym Rank / Hevy
**Anxiety:** Perdre l’historique nutrition, payer pour quelque chose de “déjà gratuit ailleurs”, bêta instable

## Customer Language
**How they describe the problem:**
- *[gap — pas de verbatims]* Hypothèses repo : « j’ai trop d’apps », « je décroche », « personne en salle »
**How they describe us:**
- « Réseau social de musculation gamifié » (meta description)
- « Tous tes sports. Une seule progression. » (welcome)
- « Entraînement, nutrition et récupération réunis au même endroit. »
**Words to use:** Rank, XP, streak / série, Lobby, check-in, Pump Check, Arène, progression, séance, spot, Mode Furtif, panthère, discipline
**Words to avoid:** Jargon infra (Supabase, Convex, hydratation cloud, sync…), “récupération des données”, ton corporate / vouvoiement
**Glossary:**
| Term | Meaning |
|------|---------|
| Rank / Rang | Tier de progression (Bronze → Légende) dérivé du level |
| XP | Points d’expérience gagnés (séances, streaks, bonus semaine…) |
| Streak | Série de jours actifs / connexion |
| Lobby | Vue salles / spots proches + membres présents après check-in |
| Pump Check | Photo post-séance → carte victoire partageable |
| Mode Furtif | Masque la localisation dans le feed social |
| Discipline | Sport principal / identité (muscu, course, football…) |
| Premium | Abo 6,99 €/mois : scanner code-barres + analyse aliments IA (+ objectifs poussés) |
| BPM | Fréquence cardiaque (caméra) — free vs Premium encore ouvert |

## Brand Voice
**Tone:** Direct, motivant, compétitif sans être toxique ; tutoiement FR
**Style:** Court, concret, orienté action (“Nouvelle séance”, “Lobby actif”) ; premium dark
**Personality:** Arène, panthère, crimson, gamifié, sportif, exclusif (bêta privée)

## Proof Points
**Metrics:** *[gap]*
**Customers:** Bêta privée / invités seulement — pas de logos publics
**Testimonials:** *[gap]*
**Value themes:**
| Theme | Proof |
|-------|-------|
| Progression unifiée | Ranks + XP + streaks dans le produit |
| All-in-one train/nutri/sleep | Engines + onglets Accueil / Train / Nutri / Profil |
| Social salle | Lobby + check-in + feed + Mode Furtif |
| Shareable wins | Pump Check / Victory Camera |

## Goals
**Business goal:** *[à confirmer]* — bêta privée solide → ouverture plus large + conversion freemium → Premium 6,99 €
**Conversion action:** Invitation / compte → usage gratuit (calories + hydratation + train) → upgrade Premium au moment du scan / IA aliments ou pour pousser les objectifs
**Current metrics:** *[gap]*

## Changelog
*Newest first. One line per revision: what changed and why.*
- v3 (2026-09-28) — Defined free vs Premium: free = calories + hydration + training; paid = barcode scan + AI food analysis; BPM still undecided.
- v2 (2026-09-28) — Set freemium + 6.99€/mo Premium; named direct competitors MyFitnessPal, Cal AI, Gym Rank; updated objections and switching dynamics.
- v1 (2026-09-28) — Initial context auto-drafted from README, welcome copy, ranks, lobby, Pump Check, nutrition/sleep engines, and legal (private beta).
