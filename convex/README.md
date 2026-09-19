# Convex functions (Ranked Gym)

Schema + auth + PR-F domain sync live here. **Supabase remains the default app backend** unless `VITE_ENABLE_CONVEX_PRIMARY` (and auth flag) are enabled.

## Modules

- `schema.ts` — compatibility tables
- `auth.ts` / `authPrivateData.ts` — PR-E (global reset, no legacy password bridge)
- `sync.ts` / `profiles.ts` — PR-F backup/sync + streak CAS
- `rpc.ts` — PR-G checkins/feed/stats + AI usage reserve/release equivalents
- `social.ts` / `lib/socialVisibility.ts` — Mission 4 feed/profile/search/follow/block/comment/reaction privacy
- `migrations.ts` — PR-I import/counting helpers used by migration scripts (internal + admin secret)
- `files.ts` — private avatar storage lifecycle (`upload` / `signed URL` / `delete`) + migration helpers

## Commands

```bash
npx convex codegen
npx convex dev
```

`npx convex dev` against a **cloud** project requires Evan to log in in the shared browser. Do not paste tokens or passwords in chat. Existing project: `ranked-gym` / `impartial-bandicoot-899` — do not create a duplicate.

Checked-in `_generated/` types are enough to typecheck without a live deployment.

See `docs/CONVEX_SETUP.md`.
