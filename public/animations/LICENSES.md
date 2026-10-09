# Animation assets — licenses

Ranked Gym ships UI motion as **locally adapted CSS / Web Animations / React** only.
Third-party *references* (CodePen / Uiverse / CodeFronts / Chrome docs) are rewritten into
`src/components/motion/` — nothing is fetched remotely at runtime.

| Asset | Source | License | Notes |
| --- | --- | --- | --- |
| _(no binary assets)_ | — | — | No Lottie / GIF / MP4 / remote files. See root `LICENCES_TIERS.md` for source attributions. |

## Policy

- Every animation asset used at runtime must be **bundled inside the app**.
- **No CDN / remote URL** loading for animation assets (must work fully offline / PWA).
- Full source URL + author + license table: [`LICENCES_TIERS.md`](../../LICENCES_TIERS.md).
