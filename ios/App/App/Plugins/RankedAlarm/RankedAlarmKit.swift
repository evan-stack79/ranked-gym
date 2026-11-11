import ActivityKit
import AlarmKit
import Capacitor
import Foundation
import SwiftUI

/**
 * AlarmKit scheduler — fork lineage: @capawesome/capacitor-alarm (MIT).
 *
 * Root-cause fix (Evan IPA f1a9516, iPhone 17 / iOS 26, silence à l’heure) :
 * Apple : if an alarm supports a *countdown presentation* but the Live Activity
 * cannot present, “the system may unexpectedly dismiss alarms and fail to alert”.
 * We therefore:
 *  1) Always build a stop-only alert that can ring without countdown UI.
 *  2) Only attach postAlert countdown / Répéter when snooze is on, with a full
 *     AlarmPresentation (alert + countdown + paused) matching the widget.
 *  3) Prefer `.fixed(Date)` for one-shot (no days) so “next HH:MM” is unambiguous.
 *  4) Re-read AlarmManager.alarms after schedule and fail if the id is missing.
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

    /// Always hits AlarmManager when not already granted so the system prompt appears.
    func requestPermissions() async throws -> String {
        try ensureUsageDescription()
        switch manager.authorizationState {
        case .authorized:
            return "granted"
        case .denied:
            // Caller must open Settings — do not throw (JS needs a clean "denied").
            return "denied"
        case .notDetermined:
            let state = try await manager.requestAuthorization()
            return mapAuth(state)
        @unknown default:
            let state = try await manager.requestAuthorization()
            return mapAuth(state)
        }
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
        let schedule = try makeSchedule(hour: hour, minute: minute, weekdays: weekdays)
        let attributes = makeAttributes(
            label: label,
            snoozeEnabled: snoozeEnabled
        )
        let sound: AlertConfiguration.AlertSound = {
            if let soundName, !soundName.isEmpty {
                return .named(soundName)
            }
            return .default
        }()

        let countdownDuration: Alarm.CountdownDuration?
        if snoozeEnabled {
            let seconds = max(60, snoozeMinutes * 60)
            countdownDuration = Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(seconds))
        } else {
            countdownDuration = nil
        }

        let configuration = AlarmManager.AlarmConfiguration<RankedGymAlarmMetadata>(
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

        // Re-read from AlarmManager — never assume schedule succeeded.
        let confirmed = try manager.alarms.contains { $0.id == id }
        guard confirmed else {
            throw RankedAlarmError.notListedAfterSchedule
        }
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

    /// True when `id` is currently present in AlarmManager.alarms.
    func hasAlarm(id: UUID) throws -> Bool {
        try manager.alarms.contains { $0.id == id }
    }

    // MARK: - Schedule builders

    private func makeSchedule(hour: Int, minute: Int, weekdays: [Locale.Weekday]) throws -> Alarm.Schedule {
        if weekdays.isEmpty {
            // One-shot: fixed local Date at next HH:MM (avoids Relative.never ambiguity).
            let next = try nextFixedDate(hour: hour, minute: minute)
            return .fixed(next)
        }
        let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
        return .relative(Alarm.Schedule.Relative(time: time, repeats: .weekly(weekdays)))
    }

    private func nextFixedDate(hour: Int, minute: Int, now: Date = Date()) throws -> Date {
        var calendar = Calendar.current
        calendar.timeZone = .current
        var comps = calendar.dateComponents([.year, .month, .day], from: now)
        comps.hour = hour
        comps.minute = minute
        comps.second = 0
        comps.nanosecond = 0
        guard var date = calendar.date(from: comps) else {
            throw RankedAlarmError.invalidSchedule
        }
        // Must be strictly in the future — AlarmKit rejects past fixed dates.
        if date.timeIntervalSince(now) < 5 {
            guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: date) else {
                throw RankedAlarmError.invalidSchedule
            }
            date = tomorrow
        }
        return date
    }

    private func makeAttributes(label: String, snoozeEnabled: Bool) -> AlarmAttributes<RankedGymAlarmMetadata> {
        let title = LocalizedStringResource(stringLiteral: label)
        let stop = AlarmButton(text: "Arrêter", textColor: .white, systemImageName: "stop.circle")
        let tint = Color(red: 0.67, green: 0.70, blue: 0.73)

        let alert: AlarmPresentation.Alert
        let presentation: AlarmPresentation

        if snoozeEnabled {
            let snooze = AlarmButton(text: "Répéter", textColor: .white, systemImageName: "repeat")
            if #available(iOS 26.1, *) {
                alert = AlarmPresentation.Alert(
                    title: title,
                    secondaryButton: snooze,
                    secondaryButtonBehavior: .countdown
                )
            } else {
                alert = AlarmPresentation.Alert(
                    title: title,
                    stopButton: stop,
                    secondaryButton: snooze,
                    secondaryButtonBehavior: .countdown
                )
            }
            // Full presentation — required so AlarmKit does not dismiss countdown alarms.
            let pauseBtn = AlarmButton(text: "Pause", textColor: .white, systemImageName: "pause")
            let resumeBtn = AlarmButton(text: "Reprendre", textColor: .white, systemImageName: "play")
            let countdown = AlarmPresentation.Countdown(
                title: LocalizedStringResource("Répéter"),
                pauseButton: pauseBtn
            )
            let paused = AlarmPresentation.Paused(
                title: LocalizedStringResource("En pause"),
                resumeButton: resumeBtn
            )
            presentation = AlarmPresentation(alert: alert, countdown: countdown, paused: paused)
        } else {
            // Capawesome-style stop-only alert — rings without Live Activity countdown.
            if #available(iOS 26.1, *) {
                alert = AlarmPresentation.Alert(title: title)
            } else {
                alert = AlarmPresentation.Alert(title: title, stopButton: stop)
            }
            presentation = AlarmPresentation(alert: alert)
        }

        return AlarmAttributes(
            presentation: presentation,
            metadata: RankedGymAlarmMetadata(),
            tintColor: tint
        )
    }

    // MARK: - Auth / labels

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
        guard let value = Bundle.main.object(forInfoDictionaryKey: "NSAlarmKitUsageDescription") as? String,
              !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
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
    case invalidSchedule
    case notListedAfterSchedule

    var errorDescription: String? {
        switch self {
        case .permissionDenied: return "Permission AlarmKit refusée"
        case .missingUsageDescription: return "NSAlarmKitUsageDescription manquante"
        case .invalidDay: return "Jour de répétition invalide"
        case .invalidSchedule: return "Horaires de réveil invalides"
        case .notListedAfterSchedule: return "Réveil non confirmé par AlarmKit"
        }
    }
}
