# Licences — animations tierces (sources gratuites)

Ranked Gym adapts these free, license-OK references **locally** (copied / rewritten into
`src/components/motion/`). Nothing is loaded from CDNs or remote URLs at runtime.

| # | Usage in app | Source URL | Author | License |
| --- | --- | --- | --- | --- |
| 1 | Fin de séance — SVG circle stroke + check draw (+ 12 sparks) | https://codepen.io/haniotis/pen/KwvYLO | Nick Haniotis (`haniotis`) | CodePen — free to adapt (MIT-style reuse of published pen CSS/SVG) |
| 2 | Série validée — checkbox « boing » → red | https://uiverse.io/vishnupprajapat/wicked-catfish-29 | vishnupprajapat | MIT (Uiverse) |
| 3 | Passage carte → page — same-document View Transitions + fade fallback | https://developer.chrome.com/docs/web-platform/view-transitions/same-document | Chrome / Web Platform | Documentation — pattern only (no asset) |
| 4 | Chargement en vague — staggered card fade-up | https://codefronts.com/motion/css-fade-in-animation/staggered-grid-card-fade/ | CodeFronts | MIT |
| 5 | Barres vivantes — dark-mode progress + `color-mix` (+ sparks once @100%) | https://codefronts.com/components/css-progress-bars/ (demo 08) | CodeFronts | MIT |
| 6a | Boutons press-in | https://uiverse.io/cssbuttons-io/evil-monkey-41 | cssbuttons-io | MIT (Uiverse) |
| 6b | Play button glow breathe (2 cycles) | https://uiverse.io/Carlos-vargs/pink-ladybug-22 | Carlos-vargs | MIT (Uiverse) |

## Policy

- Bundle every adapted file inside the app (`src/components/motion/`, `public/animations/`).
- **No CDN / remote loading** for animation assets (offline / PWA).
- Accent recolored to Ranked Gym red `#FF2B2B` — never yellow.
- See also `public/animations/LICENSES.md` for the offline-asset inventory.
