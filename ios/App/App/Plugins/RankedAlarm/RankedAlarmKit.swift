import ActivityKit
import AlarmKit
import AppIntents
import Capacitor
import Foundation
import SwiftUI

/**
 * AlarmKit scheduler — fork lineage: @capawesome/capacitor-alarm (MIT).
 *
 * Reliability (Evan GO 15/11):
 *  - One-shot = `.relative(time, repeats: .never)` (timezone-aware; never `.fixed`)
 *  - Make-before-break: schedule + verify, then cancelAll(except: newId)
 *  - cancelAll iterates AlarmManager.alarms so no orphan/duplicate
 *
 * Sound: seamless ~44 s PCM CAF; AlarmKit has no loop API (WWDC25-230).
 */
@available(iOS 26.0, *)
final class RankedAlarmKit {
    static let defaultSoundFileName = "PetitsOiseaux.caf"
    static let minLeadSeconds: TimeInterval = 5

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
    private var updatesTask: Task<Void, Never>?

    init(plugin: CAPPlugin) {
        self.plugin = plugin
        startAlarmUpdatesBridge()
    }

    deinit {
        updatesTask?.cancel()
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

    /// Beta: one-shot relative(.never) — always includes Répéter (9 min) + stopIntent.
    func scheduleFixedTest(secondsFromNow: Int) async throws -> String {
        try await authorizeIfNeeded()
        // Test uses a near-term relative time derived from now + N seconds.
        let fire = Date().addingTimeInterval(TimeInterval(max(15, secondsFromNow)))
        let cal = Calendar.current
        let hour = cal.component(.hour, from: fire)
        let minute = cal.component(.minute, from: fire)
        return try await createAlarm(
            hour: hour,
            minute: minute,
            label: "Test Ranked Gym",
            days: nil,
            snoozeMinutes: 9,
            snoozeEnabled: true,
            soundName: Self.defaultSoundFileName
        )
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

    /// Cancel every AlarmKit alarm except an optional keep id.
    func cancelAll(except keep: UUID? = nil) throws {
        let alarms = try manager.alarms
        for alarm in alarms {
            if let keep, alarm.id == keep { continue }
            try manager.cancel(id: alarm.id)
            removeLabel(for: alarm.id)
        }
    }

    /**
     * Create + verify, then cancel every other alarm (make-before-break).
     * Empty / nil days → one-shot `.relative(.never)` (never `.fixed`).
     */
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
        let schedule = try await makeSchedule(hour: hour, minute: minute, weekdays: weekdays)
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
            // Make-before-break: only cancel orphans AFTER the new alarm is verified.
            try cancelAll(except: id)
            lastError = nil
            return id.uuidString
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    func getAlarms() throws -> [[String: Any]] {
        let labels = getLabels()
        let now = Date()
        return try manager.alarms.map { alarm in
            var row: [String: Any] = [
                "id": alarm.id.uuidString,
                "enabled": true,
                "state": mapState(alarm.state),
            ]
            if let label = labels[alarm.id.uuidString] {
                row["label"] = label
            }
            let decoded = decodeSchedule(alarm.schedule, now: now)
            row["hour"] = decoded.hour as Any
            row["minute"] = decoded.minute as Any
            row["repeats"] = decoded.repeats
            if let next = decoded.nextFire {
                row["nextFireAt"] = ISO8601DateFormatter().string(from: next)
                row["nextFireAtMs"] = next.timeIntervalSince1970 * 1000
            }
            return row
        }
    }

    /// True when `id` is currently present in AlarmManager.alarms.
    func hasAlarm(id: UUID) throws -> Bool {
        try manager.alarms.contains { $0.id == id }
    }

    func alarmCount() throws -> Int {
        try manager.alarms.count
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
            }
        }
        candidates.append(contentsOf: [
            defaultSoundFileName,
            "PetitsOiseaux",
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

    private func makeSchedule(hour: Int, minute: Int, weekdays: [Locale.Weekday]) async throws -> Alarm.Schedule {
        let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
        if weekdays.isEmpty {
            // One-shot: `.relative(.never)` follows timezone (WWDC25-230). Never `.fixed`.
            // If today's occurrence is < 5 s away, wait past it so .never lands tomorrow.
            let until = secondsUntilToday(hour: hour, minute: minute)
            if until >= 0 && until < Self.minLeadSeconds {
                let ns = UInt64((until + 0.15) * 1_000_000_000)
                try await Task.sleep(nanoseconds: ns)
            }
            return .relative(Alarm.Schedule.Relative(time: time, repeats: .never))
        }
        return .relative(Alarm.Schedule.Relative(time: time, repeats: .weekly(weekdays)))
    }

    private func secondsUntilToday(hour: Int, minute: Int, now: Date = Date()) -> TimeInterval {
        var calendar = Calendar.current
        calendar.timeZone = .current
        var comps = calendar.dateComponents([.year, .month, .day], from: now)
        comps.hour = hour
        comps.minute = minute
        comps.second = 0
        comps.nanosecond = 0
        guard let date = calendar.date(from: comps) else { return -1 }
        return date.timeIntervalSince(now)
    }

    private func nextRelativeOccurrence(hour: Int, minute: Int, now: Date) -> Date {
        var calendar = Calendar.current
        calendar.timeZone = .current
        var comps = calendar.dateComponents([.year, .month, .day], from: now)
        comps.hour = hour
        comps.minute = minute
        comps.second = 0
        comps.nanosecond = 0
        guard var date = calendar.date(from: comps) else { return now }
        if date.timeIntervalSince(now) < Self.minLeadSeconds {
            date = calendar.date(byAdding: .day, value: 1, to: date) ?? date
        }
        return date
    }

    private func nextWeeklyOccurrence(hour: Int, minute: Int, weekdays: [Locale.Weekday], now: Date) -> Date {
        var calendar = Calendar.current
        calendar.timeZone = .current
        let wanted = Set(weekdays.map { weekdayNumber($0) })
        for offset in 0..<8 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
            var comps = calendar.dateComponents([.year, .month, .day], from: day)
            comps.hour = hour
            comps.minute = minute
            comps.second = 0
            comps.nanosecond = 0
            guard let candidate = calendar.date(from: comps) else { continue }
            let wd = calendar.component(.weekday, from: candidate) // 1=Sun … 7=Sat
            guard wanted.contains(wd) else { continue }
            if candidate.timeIntervalSince(now) >= Self.minLeadSeconds {
                return candidate
            }
        }
        return nextRelativeOccurrence(hour: hour, minute: minute, now: now)
    }

    private func weekdayNumber(_ day: Locale.Weekday) -> Int {
        switch day {
        case .sunday: return 1
        case .monday: return 2
        case .tuesday: return 3
        case .wednesday: return 4
        case .thursday: return 5
        case .friday: return 6
        case .saturday: return 7
        @unknown default: return 2
        }
    }

    private struct DecodedSchedule {
        let hour: Int?
        let minute: Int?
        let repeats: String
        let nextFire: Date?
    }

    private func decodeSchedule(_ schedule: Alarm.Schedule?, now: Date) -> DecodedSchedule {
        guard let schedule else {
            return DecodedSchedule(hour: nil, minute: nil, repeats: "none", nextFire: nil)
        }
        switch schedule {
        case .fixed(let date):
            let cal = Calendar.current
            return DecodedSchedule(
                hour: cal.component(.hour, from: date),
                minute: cal.component(.minute, from: date),
                repeats: "fixed",
                nextFire: date
            )
        case .relative(let relative):
            let hour = relative.time.hour
            let minute = relative.time.minute
            switch relative.repeats {
            case .never:
                return DecodedSchedule(
                    hour: hour,
                    minute: minute,
                    repeats: "never",
                    nextFire: nextRelativeOccurrence(hour: hour, minute: minute, now: now)
                )
            case .weekly(let days):
                return DecodedSchedule(
                    hour: hour,
                    minute: minute,
                    repeats: "weekly",
                    nextFire: nextWeeklyOccurrence(hour: hour, minute: minute, weekdays: days, now: now)
                )
            @unknown default:
                return DecodedSchedule(hour: hour, minute: minute, repeats: "unknown", nextFire: nil)
            }
        @unknown default:
            return DecodedSchedule(hour: nil, minute: nil, repeats: "unknown", nextFire: nil)
        }
    }

    private func mapState(_ state: Alarm.State) -> String {
        switch state {
        case .scheduled: return "scheduled"
        case .countdown: return "countdown"
        case .alerting: return "alerting"
        case .paused: return "paused"
        @unknown default: return "unknown"
        }
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

    // MARK: - Updates bridge

    private func startAlarmUpdatesBridge() {
        updatesTask?.cancel()
        updatesTask = Task { [weak self] in
            guard let self else { return }
            for await alarms in self.manager.alarmUpdates {
                let payload: [String: Any] = [
                    "count": alarms.count,
                    "ids": alarms.map { $0.id.uuidString },
                ]
                self.plugin?.notifyListeners("alarmUpdates", data: payload)
            }
        }
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
