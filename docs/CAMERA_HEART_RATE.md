# Prototype BPM caméra (PPG)

Feature flag : `VITE_ENABLE_CAMERA_HEART_RATE=true`

Entrée UI (flag ON) : **Profil → Réglages → Tester la mesure BPM**

## Principes

- Analyse **100 % native** (iOS AVFoundation / Android CameraX) — **aucun frame** envoyé au JavaScript.
- Caméra **arrière** + **flash/torch** pendant la mesure ; coupés à l’arrêt.
- Stop immédiat : annulation UI, `visibilitychange` / background, destroy plugin.
- **Aucune persistance** (pas de localStorage, pas de Supabase, pas de Health / Nutrition / Training).
- Pas de BPM si doigt absent ou signal insuffisant.
- Disclaimer obligatoire : estimation expérimentale, **pas un dispositif médical**.

## Fichiers

| Couche | Chemin |
|--------|--------|
| Flag + bridge JS | `src/native/cameraHeartRate/` |
| UI | `src/components/settings/CameraHeartRateScreen.tsx` |
| Android | `android/app/src/main/java/com/rankedgym/app/CameraHeartRatePlugin.java` |
| iOS (sources à lier dans Xcode) | `ios/App/App/Plugins/CameraHeartRatePlugin.swift` |

## Build / sync

```bash
npm test
VITE_ENABLE_CAMERA_HEART_RATE=true npm run build
VITE_ENABLE_CAMERA_HEART_RATE=true npm run cap:sync
```

### Android Studio

1. `npx cap open android`
2. Vérifier permission `CAMERA` + deps CameraX dans `app/build.gradle`
3. Lancer sur device physique (émulateur sans flash = indisponible)

### Xcode

1. `CameraHeartRatePlugin.swift` est déjà dans `ios/App/App/Plugins/` et listé dans **Compile Sources** (target App).
2. Confirmer `NSCameraUsageDescription` dans `ios/App/App/Info.plist`.
3. `CAPBridgedPlugin` + `jsName = "CameraHeartRate"` → enregistrement auto Capacitor 8.
4. Lancer sur iPhone réel (simulateur : pas de torch fiable).

## Limites

- Prototype bien-être uniquement — pas de diagnostic / arythmie.
- Précision variable (peau, mouvement, lumière ambiante).
- Web / PWA : stub `unavailable` (pas de PPG navigateur).
