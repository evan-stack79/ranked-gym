# MASVS storage posture (Mission 3)

Ranked Gym is a Capacitor webview + PWA. Storage controls differ by shell.

## Android backup

- `android:allowBackup="false"` in `android/app/src/main/AndroidManifest.xml`
- Defense in depth: `@xml/backup_rules` (fullBackupContent) and `@xml/data_extraction_rules` exclude root/file/database/sharedpref/external for cloud backup **and** device-to-device transfer (Android 12+)

## iOS backup

There is no Info.plist equivalent of `allowBackup`. No change required to disable a global backup flag.

- `UIFileSharingEnabled` is unset (defaults false) — no iTunes file sharing
- Native secrets use Keychain `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (`SecureStoragePlugin.swift`) — not restored via iCloud/iTunes to another device
- WebView localStorage may still enter an iCloud device backup as ciphertext. The wrapping key is **not** in that backup when running in the native shell

## Auth tokens

| Shell | Where tokens live | Device wrap secret |
| --- | --- | --- |
| Capacitor iOS/Android | Keystore / Keychain via `SecureStorage` plugin | Same native KV (`ranked-gym-wrap-key`) — never WebView localStorage |
| Web / PWA | AES-GCM ciphertext in localStorage (`ranked-gym-auth-v2`) | `ranked-gym-device-secret` in **clear** localStorage |

Web/PWA is **least-bad**, not Keystore. XSS, malicious extension, or a profile dump can read the wrap secret and decrypt. Do not claim otherwise.

On native boot, leftover WebView keys (`ranked-gym-auth-v2`, `ranked-gym-convex-auth-v1`, `sb-*-auth-token`, device secret) are migrated then deleted.

## Health / training blobs

`training`, `nutrition-profile`, `nutrition-journal`, `sleep-log`, `profile`, `custom-gyms`, `check-in`, `last-location` (plus `:u:<uid>` scoped variants) are encrypted at rest with AES-GCM after `initSecureLocalStore()`.

- Sync get/set APIs are unchanged so workout resume and `cloudBackup` hydrate (`skipCloud` apply/push) keep working
- Cloud payloads stay plaintext JSON **in transit to the user’s own account** (Supabase/Convex). This file only covers on-device persistence
- Guest/test paths that never call `initSecureLocalStore()` still use plaintext localStorage (unit tests, capture scripts)

## Residual MASVS risks (not this mission)

- Web/PWA wrap secret in localStorage
- Non-listed keys (streak celebration, reminders, ghost mode, settings dismiss) remain plaintext localStorage
- iOS iCloud backup of WebView ciphertext without excluding WK website data
- Cloud backups of health data at rest on the backend (Mission 4 / server policies)
- No biometric/lock-screen gate on Keychain reads
