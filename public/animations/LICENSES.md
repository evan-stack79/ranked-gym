# Animation assets — licenses

Ranked Gym ships UI motion as **first-party CSS / Web Animations / React** only.

| Asset | Source | License | Notes |
| --- | --- | --- | --- |
| _(none)_ | — | — | No third-party Lottie, GIF, MP4, or remote animation files are bundled or loaded. |

## Policy

- Every animation asset used at runtime must be **bundled inside the app** (e.g. under `public/animations/` or imported from `src/`).
- **No CDN / remote URL** loading for animation assets (must work fully offline / PWA).
- If a third-party file is added later, list it here with **source URL + license** before merge.
