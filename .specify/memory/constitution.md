# Ranked Gym Constitution

## Core Principles

### I. Spec Before Code (Reinforce Studio Gates)
Every feature change starts with a written specification before implementation.
Spec Kit (`/speckit-specify` → plan → tasks → implement → converge) reinforces
this order. It does **not** replace Studio product/science gates:

1. PRD / product intent
2. Scientific matrix with veto (when health, training, or ranking formulas are
   involved) — see `docs/MATRICE_SCIENTIFIQUE_RANKED_FORCE.md`
3. Architecture specs (e.g. `docs/SPEC_RANKED.md`, `docs/ARCHI_RANKED.md`)
4. Code
5. QA

Agents and humans must not skip science or product review by jumping to code.

### II. No Pay-to-Win (NON-NEGOTIABLE)
Rank, Ranked Force scores, Ranked Discipline scores, and seasons must never be
purchased, money-boosted, or otherwise paid to improve competitive standing.
Gym coins and Pass are cosmetic only. Monetization must not affect competitive
outcomes, ranking formulas, season placement, or verification status.

### III. Realistic, Achievable Health Goals
Health, nutrition, sleep, hydration, and training goals must stay realistic and
achievable for the user. Do not invent extreme targets, impossible progression,
or medical claims. Science-gated formulas require matrix / Vérificateur
alignment before code. Never challenge users into unsafe frequency (e.g. 7/7
sessions as a Discipline target).

### IV. French Product Copy — Everyday Language
User-facing French copy is simple everyday language. Avoid jargon, technical
boot/error dumps in the UI, and marketing fluff that obscures meaning. Prefer
short, clear sentences a gym-goer understands without a glossary.

### V. Reuse the Existing Stack
Plan and implement against the repository as it is today:

- Frontend: React + TypeScript + Vite + Capacitor (PWA / iOS / Android)
- Backend direction: Convex (see `docs/CONVEX_SETUP.md`); do not invent a new
  primary backend for features without an explicit product decision
- Tests / CI habits already in the repo: `npm run lint` (oxlint), `npm test`
  (vitest), `npm run build`, `npx convex typecheck` via `.github/workflows/ci.yml`
- Existing agent-team pipeline (`agent-team/`, `npm run agents:*`) remains the
  human/agent review path; Spec Kit adds SDD artifacts, it does not replace it

Do not introduce parallel frameworks, duplicate CI, or greenfield rewrites to
satisfy a template.

## Product & Fairness Constraints

- Competitive Ranked Force / Ranked Discipline: performance and regularity only
  — never appearance, biological age, or medical readiness scores
- Anti-cheat and verification rules come from ratified science docs; do not
  invent absolute caps or ban rules outside the matrix
- Cosmetic Bronze → Légende (XP / level) stays separate from competitive Ranked
- Secrets, deploy keys, and `.env` values never enter commits, specs, or agent
  prompts
- Leave tmp / IPA / local build artifacts alone; do not commit them

## Development Workflow

1. Capture or update constitution (this file) when guardrails change
2. `/speckit-specify` for the bounded change (what / why, compatibility bounds)
3. Optional: `/speckit-clarify`, `/speckit-checklist`, `/speckit-analyze`
4. `/speckit-plan` — reuse Convex, Capacitor, and existing test conventions
5. `/speckit-tasks` then `/speckit-implement`
6. `/speckit-converge` until gaps are closed
7. Run the repo’s established checks (`lint`, `test`, `build`, Convex typecheck
   as applicable) before asking for review

Elephant-Goldfish (EGM) memory / dual-context tooling is **out of scope** until
a later PR; do not scaffold it here.

## Governance

- This constitution governs Spec Kit planning and implementation for Ranked Gym
- Product/science docs and Studio vetoes supersede speculative agent invention
- **Merge and deploy only when Evan gives explicit GO** — agent “GO” / review
  verdicts mean “ready for Evan to review”, never auto-merge or auto-deploy
- Amendments to this constitution require a PR description of what changed and
  why; bump the version below
- All PRs that touch competitive ranking, monetization, or health goals must
  verify compliance with Principles II–IV

**Version**: 1.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
