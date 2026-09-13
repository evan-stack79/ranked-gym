# Convex functions (Ranked Gym)

Phase A scaffold only: schema + a public `health.ping` query.

Domain tables live in `schema.ts` (Profil, Train, Nutrition/Hydratation, Sommeil, Streak, files, migration bookkeeping).

This directory is **not** the live app backend yet. The React app still uses Supabase unless a later phase flips `VITE_ENABLE_CONVEX_PRIMARY` *and* migrates services.

## Commands

```bash
npx convex codegen
npx convex dev
```

`npx convex dev` against a **cloud** project requires Evan to log in in the shared browser. Do not paste tokens or passwords in chat.

Anonymous/local Convex backends may work without an account (`npx convex dev` in a non-interactive agent shell). That is optional for Phase A — generated `_generated/` types are enough to typecheck.

See `docs/CONVEX_SETUP.md`.
