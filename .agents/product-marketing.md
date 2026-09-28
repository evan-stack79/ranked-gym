# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-09-28

> Draft auto-généré depuis le repo Ranked Gym. Sections marquées *[à confirmer]* ou *[gap]* attendent ta validation.

## Product Overview
**One-liner:** Tous tes sports. Une seule progression.
**What it does:** Ranked Gym est une app mobile-first (PWA + Capacitor) qui réunit entraînement, nutrition et récupération dans un même parcours gamifié — ranks, XP, streaks — avec une couche sociale autour des salles (Lobby / check-in) et un moment de share post-séance (Pump Check).
**Product category:** App fitness / suivi d’entraînement gamifié · réseau social sportif
**Product type:** Consumer mobile app (SaaS B2C) — bêta privée sur invitation
**Business model:** *[à confirmer]* — aujourd’hui accès gratuit sur invitation ; monétisation (freemium, abo, etc.) non définie dans le repo

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
| Multi-sport | Un seul endroit pour force + endurance + co | Stack d’apps (Strava + Hevy + MyFitnessPal…) | « Tous tes sports » dans Ranked Gym |

## Problems & Pain Points
**Core problem:** Les pratiquants doivent empiler plusieurs apps pour s’entraîner, manger, récupérer et rester motivés — et la salle reste isolée socialement.
**Why alternatives fall short:**
- Loggers purs (Hevy, Strong…) : excellents sur la fonte, faibles sur nutrition/sommeil/social salle *[à confirmer vs marché]*
- Trackers nutrition (MyFitnessPal…) : hors entraînement et sans gamification “ranked”
- Apps sociales sport (Strava…) : orientées outdoor / endurance, pas l’expérience salle + ranks
- Motivation externe faible : pas de système de rang / streak unifié train+nutri+récup
**What it costs them:** Friction quotidienne, abandon de tracking, perte de motivation, données éclatées
**Emotional tension:** Se sentir seul en salle, stagner sans feedback, culpabilité quand la série casse

## Competitive Landscape
**Direct:** Apps de logging muscu gamifiées / sociales (Hevy, Strong, Alpha Progression, Freeletics…) — often strong on logging, weaker on unified train+nutri+sleep+lobby *[à affiner]*
**Secondary:** Stack multi-apps (Hevy + MyFitnessPal + Whoop/Oura + Instagram) — falls short because context and motivation are split
**Indirect:** Coach perso, carnet papier, “juste y aller” sans tracker — falls short on progression visible and accountability

## Differentiation
**Key differentiators:**
- Positionnement “rank / arène” : ranks Bronze→Légende avec titres (“Recrue de la Fonte”, “Légende Vivante”…)
- Unification entraînement + nutrition + sommeil
- Multi-disciplines (pas muscu-only)
- Lobby géolocalisé (spots proches + check-in)
- Pump Check (carte photo post-séance partageable)
- Brand dark crimson + panthère, ton FR tutoiement “Hero & Arena”
**How we do it differently:** Progression unique (XP/rank/streak) au centre, pas un logger avec un badge collé après coup
**Why that's better:** Motivation continue + moins d’apps + moment social/share natif
**Why customers choose us:** *[gap — pas encore de verbatims clients dans le repo]*

## Objections
| Objection | Response |
|-----------|----------|
| « Encore une app fitness » | Une progression pour tous tes sports — train, nutri, récup au même endroit, pas un logger de plus |
| « C’est fermé / bêta » | Oui : bêta privée sur invitation pour soigner l’expérience avant une ouverture plus large |
| « Je veux juste logger ma muscu » | Le logging force est là ; le rank + streak te gardent régulier sans friction |
| « Et ma vie privée en salle ? » | Mode Furtif (Stealth) : masque ta localisation dans le feed |

**Anti-persona:** Quelqu’un qui veut uniquement un tableau Excel / un logger ultra-minimal sans gamification ni social ; ou un pro purement outdoor-only déjà 100 % Strava sans besoin salle/nutri

## Switching Dynamics
**Push:** Fatigue de 2–3 apps, motivation plate, salle anonyme, tracking abandonné
**Pull:** Rank visible, streak, “tous tes sports”, Lobby, Pump Check, UI dark premium
**Habit:** Déjà une routine dans Hevy / Strong / notes iPhone
**Anxiety:** Perdre l’historique, communauté trop “gamer”, bêta instable, données sensibles

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
**Business goal:** *[à confirmer]* — sortir une bêta privée solide, puis ouvrir plus largement (acquisition FR fitness)
**Conversion action:** Aujourd’hui → obtention d’une invitation / création de compte ; plus tard → install + première séance + check-in Lobby *[à confirmer]*
**Current metrics:** *[gap]*

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-09-28) — Initial context auto-drafted from README, welcome copy, ranks, lobby, Pump Check, nutrition/sleep engines, and legal (private beta).
