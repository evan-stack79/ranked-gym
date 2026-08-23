# Live Activities iOS — Chrono de repos

Ranked Gym est une **PWA Vite** déployée sur Cloudflare. Les Live Activities (ActivityKit) nécessitent une **coque native iOS** (Capacitor). Le code web appelle le plugin ; le rendu lock screen / Dynamic Island est natif.

## Prérequis

- macOS + Xcode 15+
- iOS 16.2+ sur l’appareil de test
- Capacitor iOS configuré (`npx cap init` si pas encore fait)

## Installation Capacitor (une fois)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Ranked Gym" com.rankedgym.app --web-dir dist
npm run build
npx cap add ios
```

## Intégrer le plugin natif

1. Copie le dossier `ios-native/RestTimerLiveActivity/` dans `ios/App/App/Plugins/`
2. Enregistre le plugin dans le projet Xcode (target App)
3. Ajoute une **Widget Extension** :
   - File → New → Target → Widget Extension
   - Nom : `RestTimerLiveActivityWidget`
   - Remplace le contenu par `ios-native/RestTimerLiveActivityWidget/RestTimerLiveActivityWidget.swift`
   - Partage `RestTimerAttributes.swift` entre App et Extension (Target Membership)

4. Dans `Info.plist` de l’app principale :

```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

5. Capabilities → **Live Activities** activé

## Comportement

| Événement JS | Action native |
|---|---|
| `RestTimerContext.start()` | `RestTimerLiveActivity.start()` |
| Tick chaque seconde | `update({ remainingSec })` |
| Fin / Passer / OK | `end({ immediate: true })` |

UI Live Activity (dark) :
- Titre : **Temps de repos**
- Sous-titre : exercice + série
- Compte à rebours `MM:SS` en rouge

## Web / PWA seule

Sans shell Capacitor, le bridge est un **no-op** : le timer in-app (« Prêt à lancer ») continue de fonctionner normalement.

## Typo radar

Le libellé canonique est centralisé dans `src/constants/radarLabels.ts` (`RADAR_REGULARITY_LABEL = "Régularité"`). Toute variante « Égularité » / « Egularité » est normalisée à l’affichage.
