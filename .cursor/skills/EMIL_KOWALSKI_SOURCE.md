# Emil Kowalski skills — provenance

## Source

- Repository: https://github.com/emilkowalski/skills
- License: MIT (see `EMIL_KOWALSKI_LICENSE`)
- Imported commit SHA: `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128`
- Import date: 2026-09-27
- Importer path: Cursor agent → Ranked Gym `.cursor/skills/`

## Skills imported

Copied verbatim from `skills/<name>/` in the upstream repo into `.cursor/skills/<name>/`:

1. `emil-design-eng`
2. `animate`
3. `review-animations`
4. `improve-animations`
5. `find-animation-opportunities`
6. `animation-vocabulary`
7. `apple-design`
8. `mobile-native`
9. `pick-ui-library`
10. `prototype`
11. `ask-sonner`
12. `write-swift`

## Explicitly excluded

- `animate-expo` — React Native / Expo motion guidance. Ranked Gym’s primary UI is web (Vite + React) with Capacitor/iOS native plugins; Expo animation recipes are out of stack for day-to-day agent work.

## How to update

1. Clone upstream: `git clone --depth 1 https://github.com/emilkowalski/skills /tmp/emil-skills`
2. Note the new commit SHA (`git -C /tmp/emil-skills rev-parse HEAD`).
3. Replace each imported skill folder under `.cursor/skills/<name>/` with the upstream `skills/<name>/` copy (do not overwrite other Ranked Gym skills outside this list).
4. Refresh `EMIL_KOWALSKI_LICENSE` from upstream `LICENSE` if it changed.
5. Update this file’s SHA and date.
6. Keep `animate-expo` excluded unless the product stack adopts Expo.
