# AlarmKit — limite d’alarmes par app

## Ce qu’Apple documente

- `AlarmManager.AlarmError.maximumLimitReached` — erreur levée quand l’app dépasse le plafond système.
- Source : [AlarmManager.AlarmError](https://developer.apple.com/documentation/alarmkit/alarmmanager/alarmerror) (pas de chiffre publié dans la doc Apple consultée).
- `Alarm.Schedule.fixed` et `Relative.Recurrence.weekly` sont documentés ; l’alternance A/B n’existe pas nativement.

## Pratique observée (non officielle)

- Sur iOS 26.0, le plafond observé est d’environ **64** alarmes actives par app.
- Source tierce : [Swift Crafted — AlarmKit iOS 26](https://swiftcrafted.dev/article/alarmkit-ios-26-schedule-alarms-countdown-timers-swiftui) (`SchedulingError.limitReached` / cap ≈ 64).

## Choix produit Ranked Gym (Emploi du temps variable)

| Constante | Valeur | Raison |
|---|---|---|
| `HV_MAX_ARMED_ALARMS` | **14** | ≤ fenêtre produit 7–14 (NOTES / état 29) et ≪ ~64 pratique |

- Semaines A/B : pré-armement en alarmes **fixes** (état 29 A), réécrit à chaque ouverture.
- Le chemin classique `createAlarm` (one-shot `.relative(.never)` + make-before-break, e1a8801) **n’est pas modifié**.
- Nouveau chemin HV : `createFixedAlarm` (sans `cancelAll` entre chaque armement).
