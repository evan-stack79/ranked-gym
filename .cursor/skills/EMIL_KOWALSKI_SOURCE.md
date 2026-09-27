# Emil Kowalski skills — provenance

## Source

- Repository: https://github.com/emilkowalski/skills
- License: MIT (see `EMIL_KOWALSKI_LICENSE`)
- Imported commit SHA: `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128`
- Import date: 2026-09-27
- Importer path: Cursor agent → Ranked Gym `.cursor/skills/`

## Skills imported (13 — full package)

Copied verbatim from `skills/<name>/` in the upstream repo into `.cursor/skills/<name>/`:

1. `emil-design-eng`
2. `animate`
3. `animate-expo`
4. `review-animations`
5. `improve-animations`
6. `find-animation-opportunities`
7. `animation-vocabulary`
8. `apple-design`
9. `write-swift`
10. `pick-ui-library`
11. `prototype`
12. `mobile-native`
13. `ask-sonner`

No upstream skill at this SHA was excluded.

## How to update

1. Clone upstream: `git clone --depth 1 https://github.com/emilkowalski/skills /tmp/emil-skills`
2. Note the new commit SHA (`git -C /tmp/emil-skills rev-parse HEAD`).
3. Replace each skill folder under `.cursor/skills/<name>/` with the upstream `skills/<name>/` copy (do not overwrite Ranked Gym skills outside this list).
4. Refresh `EMIL_KOWALSKI_LICENSE` from upstream `LICENSE` if it changed.
5. Update this file’s SHA, date, and skill list.
6. `diff -rq` each folder against upstream to confirm identity.
