import Foundation

/**
 * Flag lu par le plugin Capacitor après Arrêter (stopIntent).
 * LiveActivityIntent avec openAppWhenRun écrit ici avant le cold launch JS.
 */
enum RankedAlarmPendingMorning {
    static let defaultsKey = "ranked_gym_pending_morning_after_alarm_stop"

    static func markStopped(alarmID: String) {
        UserDefaults.standard.set(
            [
                "at": Date().timeIntervalSince1970,
                "alarmID": alarmID,
                "pending": true,
            ],
            forKey: defaultsKey
        )
        UserDefaults.standard.synchronize()
    }

    /// Returns pending payload and clears the flag (one-shot).
    static func consume() -> [String: Any]? {
        guard let raw = UserDefaults.standard.dictionary(forKey: defaultsKey) else {
            return nil
        }
        UserDefaults.standard.removeObject(forKey: defaultsKey)
        UserDefaults.standard.synchronize()
        return raw
    }

    static func isPending() -> Bool {
        UserDefaults.standard.dictionary(forKey: defaultsKey) != nil
    }
}
