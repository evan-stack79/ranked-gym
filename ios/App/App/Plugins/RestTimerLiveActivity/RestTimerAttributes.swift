import ActivityKit
import Foundation

/**
 * Unified Live Activity attributes (Dynamic Island + lock screen).
 * One activity at a time for session+rest — `kind` switches the drawing.
 * Kinds: rest | session | steps | record | rank
 */
@available(iOS 16.1, *)
struct RankedGymLiveAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// rest | session | steps | record | rank
        var kind: String

        // Rest
        var remainingSec: Int
        var totalSec: Int
        var paused: Bool

        // Session
        var exerciseName: String
        var setIndex: Int
        var setTotal: Int
        var weightKg: Double
        var reps: Int
        var startedAtMs: Double

        // Steps (user-chosen goal — never framed as a health rule)
        var steps: Int
        var stepsGoal: Int

        // Short alerts (record / rank)
        var alertTitle: String
        var alertBody: String

        var subtitle: String
    }

    /// Stable identity for the single session/rest activity.
    var activityToken: String
}

/// Legacy name kept so older references compile during rename.
@available(iOS 16.1, *)
typealias RestTimerAttributes = RankedGymLiveAttributes
