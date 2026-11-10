# Spec Kit — Ranked Gym

Guide court (FR simple) + notes for agents (EN).

## À quoi ça sert / Purpose

**FR :** Spec Kit aide l’équipe à écrire la spec **avant** le code. Ça renforce
le pipeline Studio (PRD → matrice scientifique / veto → archi → code → QA). Ça
ne remplace pas ces portes.

**EN:** Spec-Driven Development tooling for the next features. Spec Kit
artifacts live under `.specify/`; Cursor skills under `.cursor/skills/speckit-*`.

## Intégration choisie / Integration

| Choix | Valeur |
|-------|--------|
| CLI | `specify-cli` (PyPI) — verified with `specify version` |
| Integration key | `cursor-agent` |
| Why | Repo already uses Cursor (Cloud Agents, `.cursor/skills`). Official key for Cursor is `cursor-agent` (not `cursor`). Claude Code = `claude`, Copilot = `copilot` — usable later via `specify integration install`. |
| Init | `specify init --here --force --non-interactive --integration cursor-agent --ignore-agent-tools` |

## Installer le CLI (local)

Prérequis : Python 3.11+, [uv](https://docs.astral.sh/uv/).

```bash
# Install uv if needed, then:
uv tool install specify-cli
specify version   # sanity check (e.g. 1.2.5+)
```

Alternative : `pipx install specify-cli` or `pip install specify-cli`.

## Constitution

Fichier : `.specify/memory/constitution.md`

Contient les garde-fous Ranked Gym : pas de pay-to-win, objectifs santé
réalistes, français produit simple, merge/deploy seulement avec **GO Evan**,
réutilisation Convex / Capacitor / CI existante.

Mettre à jour via skill Cursor : `/speckit-constitution …`

## Commandes suivantes / Next commands

Dans Cursor (chat), après constitution :

1. `/speckit-specify` — décrire le changement borné (quoi / pourquoi)
2. `/speckit-plan` — plan contre l’archi existante
3. `/speckit-tasks` — découper en tâches
4. `/speckit-implement` — coder
5. `/speckit-converge` — trouver les trous restants, boucler si besoin

Optionnel : `/speckit-clarify`, `/speckit-checklist`, `/speckit-analyze`.

Shorthand EN flow: **specify → plan → tasks → implement → converge**.

## Hors scope / Out of scope (cette baseline)

- **Elephant-Goldfish (EGM)** : plus tard, pas dans cette PR
- Pas de réécriture app, pas de deploy Convex, pas de merge auto

## Vérifier localement / Verify locally

```bash
specify version
test -f .specify/memory/constitution.md
test -f .specify/init-options.json
ls .cursor/skills/speckit-specify/SKILL.md
# CI existante inchangée en intention :
npm run lint && npm test && npm run build
```

Merge / deploy : **attendre le GO d’Evan**.
