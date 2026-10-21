# Live Activity (iOS) — Dynamic Island / lock screen

Source of truth (App + Widget targets):

- `ios/App/App/Plugins/RestTimerLiveActivity/RestTimerAttributes.swift` — `RankedGymLiveAttributes` (`kind`)
- `ios/App/App/Plugins/RestTimerLiveActivity/RestTimerLiveActivityPlugin.swift` — `LiveActivityPlugin`
- `ios/App/App/Plugins/RestTimerLiveActivity/LiveActivityIntents.swift` — Pause / Stop / Valider
- `ios/App/RestTimerLiveActivityWidget/RestTimerLiveActivityWidget.swift` — UI by kind

Registered in `MainViewController.swift` via `LiveActivityPlugin()`.

React bridge: `src/services/liveActivity.ts` (+ compat `restTimerLiveActivity.ts`).
