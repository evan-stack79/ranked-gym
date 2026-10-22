import AppIntents
import Foundation

/// Darwin notify keys — widget → app (no App Group required).
enum LiveActivityActionNotify {
    static let pause = "com.rankedgym.live.action.pause" as CFString
    static let stop = "com.rankedgym.live.action.stop" as CFString
    static let validate = "com.rankedgym.live.action.validate" as CFString

    static func post(_ name: CFString) {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(name),
            nil,
            nil,
            true
        )
    }
}

@available(iOS 17.0, *)
struct LiveActivityPauseIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause"
    static var description = IntentDescription("Mettre le chrono de repos en pause")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        LiveActivityActionNotify.post(LiveActivityActionNotify.pause)
        return .result()
    }
}

@available(iOS 17.0, *)
struct LiveActivityStopIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Stop"
    static var description = IntentDescription("Arrêter le chrono de repos")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        LiveActivityActionNotify.post(LiveActivityActionNotify.stop)
        return .result()
    }
}

@available(iOS 17.0, *)
struct LiveActivityValidateIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Valider"
    static var description = IntentDescription("Valider la série en cours")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        LiveActivityActionNotify.post(LiveActivityActionNotify.validate)
        return .result()
    }
}
