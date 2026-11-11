import AlarmKit
import Capacitor
import Foundation
import SwiftUI

/**
 * AlarmKit scheduler — fork lineage: @capawesome/capacitor-alarm (MIT).
 * Ranked Gym: snooze 9 min (countdown), French Arrêter/Répéter, custom sound.
 * Soft volume ramp is baked into RugissementRankedGym.* (no AlarmKit volume API).
 */
@available(iOS 26.0, *)
final class RankedAlarmKit {
    private let manager = AlarmManager.shared
    private let labelsKey = "ranked_gym_alarm_labels"
    private weak var plugin: CAPPlugin?

    init(plugin: CAPPlugin) {
        self.plugin = plugin
    }

    func permissionState() -> String {
        mapAuth(manager.authorizationState)
    }

    func requestPermissions() async throws -> String {
        try ensureUsageDescription()
        let state = try await manager.requestAuthorization()
        return mapAuth(state)
    }

    func cancelAlarm(id: UUID, completion: @escaping (Error?) -> Void) {
        do {
            try manager.cancel(id: id)
            removeLabel(for: id)
            completion(nil)
        } catch {
            completion(error)
        }
    }

    func createAlarm(
        hour: Int,
        minute: Int,
        label: String,
        days: [String]?,
        snoozeMinutes: Int,
        snoozeEnabled: Bool,
        soundName: String?
    ) async throws -> String {
        try await authorizeIfNeeded()

        let weekdays = try parseDays(days)
        let schedule: Alarm.Schedule = {
            let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
            if weekdays.isEmpty {
                return .relative(Alarm.Schedule.Relative(time: time, repeats: .never))
            }
            return .relative(Alarm.Schedule.Relative(time: time, repeats: .weekly(weekdays)))
        }()

        let stop = AlarmButton(text: "Arrêter", textColor: .white, systemImageName: "stop.circle")
        let alert: AlarmPresentation.Alert
        let presentation: AlarmPresentation
        let countdownDuration: Alarm.CountdownDuration?

        if snoozeEnabled {
            let snooze = AlarmButton(text: "Répéter", textColor: .white, systemImageName: "repeat")
            if #available(iOS 26.1, *) {
                alert = AlarmPresentation.Alert(
                    title: LocalizedStringResource(stringLiteral: label),
                    secondaryButton: snooze,
                    secondaryButtonBehavior: .countdown
                )
            } else {
                alert = AlarmPresentation.Alert(
                    title: LocalizedStringResource(stringLiteral: label),
                    stopButton: stop,
                    secondaryButton: snooze,
                    secondaryButtonBehavior: .countdown
                )
            }
            let countdown = AlarmPresentation.Countdown(title: LocalizedStringResource("Répéter"))
            presentation = AlarmPresentation(alert: alert, countdown: countdown)
            let seconds = max(60, snoozeMinutes * 60)
            countdownDuration = Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(seconds))
        } else {
            if #available(iOS 26.1, *) {
                alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: label))
            } else {
                alert = AlarmPresentation.Alert(
                    title: LocalizedStringResource(stringLiteral: label),
                    stopButton: stop
                )
            }
            presentation = AlarmPresentation(alert: alert)
            countdownDuration = nil
        }

        // Tint: grey (marketing — red rare). Eyes/crown stay brand red elsewhere.
        let tint = Color(red: 0.67, green: 0.70, blue: 0.73)
        let attributes = AlarmAttributes<RankedGymAlarmMetadata>(
            presentation: presentation,
            metadata: RankedGymAlarmMetadata(),
            tintColor: tint
        )

        let sound: AlertConfiguration.AlertSound = {
            if let soundName, !soundName.isEmpty {
                return .named(soundName)
            }
            return .default
        }()
        let configuration: AlarmManager.AlarmConfiguration<RankedGymAlarmMetadata> = .alarm(
            countdownDuration: countdownDuration,
            schedule: schedule,
            attributes: attributes,
            stopIntent: nil,
            secondaryIntent: nil,
            sound: sound
        )

        let id = UUID()
        _ = try await manager.schedule(id: id, configuration: configuration)
        setLabel(label, for: id)
        return id.uuidString
    }

    func getAlarms() throws -> [[String: Any]] {
        let labels = getLabels()
        return try manager.alarms.map { alarm in
            var row: [String: Any] = [
                "id": alarm.id.uuidString,
                "enabled": true,
            ]
            if let label = labels[alarm.id.uuidString] {
                row["label"] = label
            }
            return row
        }
    }

    private func authorizeIfNeeded() async throws {
        switch manager.authorizationState {
        case .authorized:
            return
        case .denied:
            throw RankedAlarmError.permissionDenied
        case .notDetermined:
            try ensureUsageDescription()
            let state = try await manager.requestAuthorization()
            guard state == .authorized else { throw RankedAlarmError.permissionDenied }
        @unknown default:
            throw RankedAlarmError.permissionDenied
        }
    }

    private func ensureUsageDescription() throws {
        guard Bundle.main.object(forInfoDictionaryKey: "NSAlarmKitUsageDescription") is String else {
            throw RankedAlarmError.missingUsageDescription
        }
    }

    private func mapAuth(_ state: AlarmManager.AuthorizationState) -> String {
        switch state {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    private func parseDays(_ days: [String]?) throws -> [Locale.Weekday] {
        guard let days, !days.isEmpty else { return [] }
        return try days.map { day in
            switch day.uppercased() {
            case "MONDAY": return .monday
            case "TUESDAY": return .tuesday
            case "WEDNESDAY": return .wednesday
            case "THURSDAY": return .thursday
            case "FRIDAY": return .friday
            case "SATURDAY": return .saturday
            case "SUNDAY": return .sunday
            default: throw RankedAlarmError.invalidDay
            }
        }
    }

    private func getLabels() -> [String: String] {
        UserDefaults.standard.dictionary(forKey: labelsKey) as? [String: String] ?? [:]
    }

    private func setLabel(_ label: String, for id: UUID) {
        var labels = getLabels()
        labels[id.uuidString] = label
        UserDefaults.standard.set(labels, forKey: labelsKey)
    }

    private func removeLabel(for id: UUID) {
        var labels = getLabels()
        labels.removeValue(forKey: id.uuidString)
        UserDefaults.standard.set(labels, forKey: labelsKey)
    }
}

@available(iOS 26.0, *)
enum RankedAlarmError: LocalizedError {
    case permissionDenied
    case missingUsageDescription
    case invalidDay

    var errorDescription: String? {
        switch self {
        case .permissionDenied: return "Permission AlarmKit refusée"
        case .missingUsageDescription: return "NSAlarmKitUsageDescription manquante"
        case .invalidDay: return "Jour de répétition invalide"
        }
    }
}
