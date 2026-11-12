import ActivityKit
import AlarmKit
import AppIntents
import Capacitor
import Foundation
import SwiftUI

/**
 * AlarmKit scheduler — fork lineage: @capawesome/capacitor-alarm (MIT).
 *
 * Evan IPA 870b206 (iPhone) — alarm rings, but:
 *  1) Arrêter must open app → morning « Tu as bien dormi ? » (stopIntent LiveActivityIntent)
 *  2) Répéter requires snooze presentation + postAlert countdown (test was snooze-off)
 *  3) Custom roar needs exact bundle filename with extension for AlertSound.named
 */
@available(iOS 26.0, *)
final class RankedAlarmKit {
    static let defaultSoundFileName = "RugissementRankedGym.caf"

    struct Diagnostics {
        let authorization: String
        let alarmCount: Int
        let lastError: String?
        let hasUsageDescription: Bool
        let soundInBundle: Bool
        let soundResolvedName: String
    }

    private let manager = AlarmManager.shared
    private let labelsKey = "ranked_gym_alarm_labels"
    private weak var plugin: CAPPlugin?
    private(set) var lastError: String?

    init(plugin: CAPPlugin) {
        self.plugin = plugin
    }

    func permissionState() -> String {
        mapAuth(manager.authorizationState)
    }

    /// Raw AlarmKit authorization for the beta diagnostic panel.
    func rawAuthorization() -> String {
        switch manager.authorizationState {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    func diagnostics() throws -> Diagnostics {
        let usage = Bundle.main.object(forInfoDictionaryKey: "NSAlarmKitUsageDescription") as? String
        let resolved = Self.resolveBundledSoundName(preferred: Self.defaultSoundFileName)
        return Diagnostics(
            authorization: rawAuthorization(),
            alarmCount: try manager.alarms.count,
            lastError: lastError,
            hasUsageDescription: !(usage ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            soundInBundle: Self.bundleContainsSound(resolved),
            soundResolvedName: resolved
        )
    }

    /// Always hits AlarmManager when not already granted so the system prompt appears.
    func requestPermissions() async throws -> String {
        do {
            try ensureUsageDescription()
            switch manager.authorizationState {
            case .authorized:
                return "granted"
            case .denied:
                lastError = "authorizationState=denied"
                return "denied"
            case .notDetermined:
                let state = try await manager.requestAuthorization()
                let mapped = mapAuth(state)
                if mapped != "granted" {
                    lastError = "requestAuthorization→\(rawAuthorization())"
                }
                return mapped
            @unknown default:
                let state = try await manager.requestAuthorization()
                return mapAuth(state)
            }
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    /// Beta: one-shot fixed alarm — always includes Répéter (9 min) + stopIntent.
    func scheduleFixedTest(secondsFromNow: Int) async throws -> String {
        try await authorizeIfNeeded()
        let fire = Date().addingTimeInterval(TimeInterval(max(15, secondsFromNow)))
        let id = UUID()
        let attributes = makeAttributes(label: "Test Ranked Gym", snoozeEnabled: true)
        let sound = makeAlertSound(named: Self.defaultSoundFileName)
        let snoozeSeconds = TimeInterval(9 * 60)
        let configuration = AlarmManager.AlarmConfiguration<RankedGymAlarmMetadata>(
            countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: snoozeSeconds),
            schedule: .fixed(fire),
            attributes: attributes,
            stopIntent: RankedAlarmStopIntent(alarmID: id.uuidString),
            secondaryIntent: nil,
            sound: sound
        )
        do {
            _ = try await manager.schedule(id: id, configuration: configuration)
            setLabel("Test Ranked Gym", for: id)
            guard try manager.alarms.contains(where: { $0.id == id }) else {
                lastError = "test alarm not listed after schedule"
                throw RankedAlarmError.notListedAfterSchedule
            }
            lastError = nil
            return id.uuidString
        } catch {
            lastError = error.localizedDescription
            throw error
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
        do {
            try await authorizeIfNeeded()
        } catch {
            lastError = error.localizedDescription
            throw error
        }

        let weekdays = try parseDays(days)
        let schedule = try makeSchedule(hour: hour, minute: minute, weekdays: weekdays)
        let attributes = makeAttributes(
            label: label,
            snoozeEnabled: snoozeEnabled
        )
        let sound = makeAlertSound(named: soundName)

        let countdownDuration: Alarm.CountdownDuration?
        if snoozeEnabled {
            let seconds = max(60, snoozeMinutes * 60)
            countdownDuration = Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(seconds))
        } else {
            countdownDuration = nil
        }

        let id = UUID()
        let configuration = AlarmManager.AlarmConfiguration<RankedGymAlarmMetadata>(
            countdownDuration: countdownDuration,
            schedule: schedule,
            attributes: attributes,
            stopIntent: RankedAlarmStopIntent(alarmID: id.uuidString),
            secondaryIntent: nil,
            sound: sound
        )

        do {
            _ = try await manager.schedule(id: id, configuration: configuration)
            setLabel(label, for: id)
            let confirmed = try manager.alarms.contains { $0.id == id }
            guard confirmed else {
                lastError = "alarm not listed after schedule"
                throw RankedAlarmError.notListedAfterSchedule
            }
            lastError = nil
            return id.uuidString
        } catch {
            lastError = error.localizedDescription
            throw error
        }
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

    // MARK: - Sound

    func makeAlertSound(named preferred: String?) -> AlertConfiguration.AlertSound {
        let resolved = Self.resolveBundledSoundName(preferred: preferred)
        if !Self.bundleContainsSound(resolved) {
            lastError = "sound missing in bundle: \(resolved)"
        }
        return .named(resolved)
    }

    static func resolveBundledSoundName(preferred: String?) -> String {
        var candidates: [String] = []
        if let preferred, !preferred.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let trimmed = preferred.trimmingCharacters(in: .whitespacesAndNewlines)
            candidates.append(trimmed)
            if !trimmed.contains(".") {
                candidates.append("\(trimmed).caf")
                candidates.append("\(trimmed).wav")
            }
        }
        candidates.append(contentsOf: [
            defaultSoundFileName,
            "RugissementRankedGym.wav",
            "RugissementRankedGym",
        ])
        for name in candidates {
            if bundleContainsSound(name) {
                return name.contains(".") ? name : "\(name).caf"
            }
        }
        return defaultSoundFileName
    }

    static func bundleContainsSound(_ fileName: String) -> Bool {
        let ns = fileName as NSString
        let ext = ns.pathExtension
        let base = ns.deletingPathExtension
        if !ext.isEmpty, Bundle.main.url(forResource: base, withExtension: ext) != nil {
            return true
        }
        if Bundle.main.url(forResource: fileName, withExtension: nil) != nil {
            return true
        }
        if Bundle.main.path(forResource: base, ofType: ext.isEmpty ? "caf" : ext) != nil {
            return true
        }
        return false
    }

    // MARK: - Schedule builders

    private func makeSchedule(hour: Int, minute: Int, weekdays: [Locale.Weekday]) throws -> Alarm.Schedule {
        if weekdays.isEmpty {
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
            // iOS 26.1+ : stopButton param deprecated — system provides Arrêter;
            // secondaryButton + .countdown shows Répéter with postAlert duration.
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
