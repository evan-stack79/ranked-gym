import AlarmKit
import AppIntents
import Foundation

/**
 * stopIntent AlarmKit — doit être un LiveActivityIntent (AppIntent seul ne marche pas).
 *
 * WWDC25 utilise encore `openAppWhenRun = true`. Sur SDK récents, `supportedModes`
 * `.foreground(.immediate)` est préféré quand disponible ; on garde openAppWhenRun
 * pour compatibilité Xcode 26.0–26.1.
 */
@available(iOS 26.0, *)
public struct RankedAlarmStopIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Arrêter"
    public static var description = IntentDescription("Ouvre Ranked Gym après l’arrêt du réveil.")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Alarm ID")
    public var alarmID: String

    public init() {
        self.alarmID = ""
    }

    public init(alarmID: String) {
        self.alarmID = alarmID
    }

    @MainActor
    public func perform() async throws -> some IntentResult {
        RankedAlarmPendingMorning.markStopped(alarmID: alarmID)
        return .result()
    }
}
