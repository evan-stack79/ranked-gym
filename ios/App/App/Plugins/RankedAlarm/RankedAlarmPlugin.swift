import Capacitor
import Foundation
import UIKit

/**
 * Capacitor bridge — jsName **RankedAlarm** (App-local CAPBridgedPlugin).
 * Registered in MainViewController.capacitorDidLoad via registerPluginInstance.
 * Lazy-inits AlarmKit so we never resolve "denied" just because load() raced.
 */
@objc(RankedAlarmPlugin)
public class RankedAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RankedAlarmPlugin"
    public let jsName = "RankedAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "cancelAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDiagnostics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleTestInOneMinute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingMorningPrompt", returnType: CAPPluginReturnPromise),
    ]

    private var implementation: Any?

    override public func load() {
        ensureImpl()
    }

    @discardableResult
    private func ensureImpl() -> Any? {
        if implementation != nil { return implementation }
        if #available(iOS 26.0, *) {
            implementation = RankedAlarmKit(plugin: self)
        }
        return implementation
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true, "native": true])
        } else {
            call.resolve(["available": false, "native": true])
        }
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Cannot open Settings", "SETTINGS")
                return
            }
            UIApplication.shared.open(url, options: [:]) { ok in
                if ok { call.resolve() } else { call.reject("Settings open failed", "SETTINGS") }
            }
        }
    }

    @objc func getDiagnostics(_ call: CAPPluginCall) {
        let ios = UIDevice.current.systemVersion
        if #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit {
            do {
                let diag = try impl.diagnostics()
                call.resolve([
                    "native": true,
                    "iosVersion": ios,
                    "alarmKitAvailable": true,
                    "authorization": diag.authorization,
                    "alarmCount": diag.alarmCount,
                    "lastError": diag.lastError as Any,
                    "hasUsageDescription": diag.hasUsageDescription,
                    "soundInBundle": diag.soundInBundle,
                    "soundResolvedName": diag.soundResolvedName,
                ])
            } catch {
                call.resolve([
                    "native": true,
                    "iosVersion": ios,
                    "alarmKitAvailable": true,
                    "authorization": "unknown",
                    "alarmCount": 0,
                    "lastError": error.localizedDescription,
                    "hasUsageDescription": Bundle.main.object(forInfoDictionaryKey: "NSAlarmKitUsageDescription") is String,
                    "soundInBundle": false,
                    "soundResolvedName": RankedAlarmKit.defaultSoundFileName,
                ])
            }
            return
        }
        call.resolve([
            "native": true,
            "iosVersion": ios,
            "alarmKitAvailable": false,
            "authorization": "unavailable",
            "alarmCount": 0,
            "lastError": "AlarmKit requires iOS 26+",
            "hasUsageDescription": Bundle.main.object(forInfoDictionaryKey: "NSAlarmKitUsageDescription") is String,
            "soundInBundle": false,
            "soundResolvedName": "",
        ])
    }

    /// One-shot after Arrêter (stopIntent) — JS opens « Tu as bien dormi ? ».
    @objc func consumePendingMorningPrompt(_ call: CAPPluginCall) {
        if let raw = RankedAlarmPendingMorning.consume() {
            call.resolve([
                "pending": true,
                "alarmID": raw["alarmID"] as? String ?? "",
                "at": raw["at"] as? Double ?? 0,
            ])
        } else {
            call.resolve(["pending": false])
        }
    }

    @objc func scheduleTestInOneMinute(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.reject("AlarmKit unavailable (requires iOS 26+)", "UNAVAILABLE")
            return
        }
        Task {
            do {
                let auth = try await impl.requestPermissions()
                guard auth == "granted" else {
                    call.reject("Permission AlarmKit refusée", "PERMISSION_DENIED")
                    return
                }
                let id = try await impl.scheduleFixedTest(secondsFromNow: 60)
                call.resolve(["id": id, "secondsFromNow": 60])
            } catch {
                call.reject(error.localizedDescription, "SCHEDULE_FAILED", error)
            }
        }
    }

    @objc func cancelAlarm(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.reject("AlarmKit unavailable (requires iOS 26+)", "UNAVAILABLE")
            return
        }
        guard let id = call.getString("id"), let uuid = UUID(uuidString: id) else {
            call.reject("Invalid alarm id", "INVALID_ID")
            return
        }
        impl.cancelAlarm(id: uuid) { error in
            if let error {
                call.reject(error.localizedDescription, nil, error)
            } else {
                call.resolve()
            }
        }
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.resolve(["alarms": "denied"])
            return
        }
        call.resolve(["alarms": impl.permissionState()])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.resolve(["alarms": "denied"])
            return
        }
        Task {
            do {
                let state = try await impl.requestPermissions()
                call.resolve(["alarms": state])
            } catch {
                call.reject(error.localizedDescription, "PERMISSION_DENIED", error)
            }
        }
    }

    @objc func createAlarm(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.reject("AlarmKit unavailable (requires iOS 26+)", "UNAVAILABLE")
            return
        }
        guard let hour = call.getInt("hour"), (0...23).contains(hour) else {
            call.reject("Invalid hour", "INVALID_TIME")
            return
        }
        guard let minute = call.getInt("minute"), (0...59).contains(minute) else {
            call.reject("Invalid minute", "INVALID_TIME")
            return
        }
        let label = call.getString("label") ?? "Réveil"
        let snoozeMinutes = call.getInt("snoozeMinutes") ?? 9
        let soundName = call.getString("soundName")
        let snoozeEnabled = call.getBool("snoozeEnabled") ?? true
        let daysRaw = call.getArray("days", String.self)

        Task {
            do {
                let auth = try await impl.requestPermissions()
                guard auth == "granted" else {
                    call.reject("Permission AlarmKit refusée", "PERMISSION_DENIED")
                    return
                }
                let id = try await impl.createAlarm(
                    hour: hour,
                    minute: minute,
                    label: label,
                    days: daysRaw,
                    snoozeMinutes: snoozeMinutes,
                    snoozeEnabled: snoozeEnabled,
                    soundName: soundName
                )
                call.resolve(["id": id])
            } catch {
                call.reject(error.localizedDescription, "SCHEDULE_FAILED", error)
            }
        }
    }

    @objc func getAlarms(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.resolve(["alarms": []])
            return
        }
        do {
            call.resolve(["alarms": try impl.getAlarms()])
        } catch {
            call.reject(error.localizedDescription, nil, error)
        }
    }

    @objc func verifyAlarm(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = ensureImpl() as? RankedAlarmKit else {
            call.resolve(["present": false])
            return
        }
        guard let id = call.getString("id"), let uuid = UUID(uuidString: id) else {
            call.resolve(["present": false])
            return
        }
        do {
            call.resolve(["present": try impl.hasAlarm(id: uuid)])
        } catch {
            call.reject(error.localizedDescription, nil, error)
        }
    }
}
