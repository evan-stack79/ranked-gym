Ranked Gym compiles the AlarmKit implementation from
`ios/App/App/Plugins/RankedAlarm/` (App-local CAPBridgedPlugin, jsName `RankedAlarm`)
so Live Activity metadata can be shared with the widget extension.

JS talks to it via `src/native/rankedAlarm` (`registerPlugin('RankedAlarm')`).
The plugin is registered in `MainViewController.capacitorDidLoad` —
it is **not** listed in `capacitor.config.json` `packageClassList` (App-local).

This folder keeps the MIT fork lineage from `@capawesome/capacitor-alarm`.
Do not import `@ranked-gym/capacitor-alarm` from the app UI anymore (silent web stub risk).
