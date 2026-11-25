import Capacitor
import Foundation
import UIKit

/**
 * Capacitor bridge for Ranked Gym réveil (fork of @capawesome/capacitor-alarm, MIT).
 * jsName "Alarm" matches `@ranked-gym/capacitor-alarm`.
 *
 * Auth: requestPermissions MUST surface the system AlarmKit prompt before schedule.
 * openAppSettings: deep-link when authorization is denied.
 */
@objc(RankedAlarmPlugin)
public class RankedAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RankedAlarmPlugin"
    public let jsName = "Alarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "cancelAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createTimer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyAlarm", returnType: CAPPluginReturnPromise),
    ]

    private var implementation: Any?

    override public func load() {
        if #available(iOS 26.0, *) {
            self.implementation = RankedAlarmKit(plugin: self)
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Cannot open Settings")
                return
            }
            UIApplication.shared.open(url, options: [:]) { ok in
                if ok { call.resolve() } else { call.reject("Settings open failed") }
            }
        }
    }

    @objc func cancelAlarm(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = implementation as? RankedAlarmKit else {
            call.reject("AlarmKit unavailable (requires iOS 26+)")
            return
        }
        guard let id = call.getString("id"), let uuid = UUID(uuidString: id) else {
            call.reject("Invalid alarm id")
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
        guard #available(iOS 26.0, *), let impl = implementation as? RankedAlarmKit else {
            call.resolve(["alarms": "denied"])
            return
        }
        call.resolve(["alarms": impl.permissionState()])
    }

    /// Always calls AlarmManager.requestAuthorization when not already granted,
    /// so the system prompt appears on first réveil setup.
    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = implementation as? RankedAlarmKit else {
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
        guard #available(iOS 26.0, *), let impl = implementation as? RankedAlarmKit else {
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
                // Auth FIRST — never schedule without an explicit authorization pass.
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
                let msg = error.localizedDescription
                let code: String
                if msg.localizedCaseInsensitiveContains("refus") || msg.localizedCaseInsensitiveContains("permission") {
                    code = "PERMISSION_DENIED"
                } else if msg.localizedCaseInsensitiveContains("confirmé") {
                    code = "NOT_CONFIRMED"
                } else {
                    code = "SCHEDULE_FAILED"
                }
                call.reject(msg, code, error)
            }
        }
    }

    @objc func getAlarms(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *), let impl = implementation as? RankedAlarmKit else {
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
        guard #available(iOS 26.0, *), let impl = implementation as? RankedAlarmKit else {
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

    @objc func createTimer(_ call: CAPPluginCall) {
        call.unimplemented("createTimer is not used by Ranked Gym")
    }

    @objc func openAlarms(_ call: CAPPluginCall) {
        call.unimplemented("openAlarms is Android-only")
    }
}
