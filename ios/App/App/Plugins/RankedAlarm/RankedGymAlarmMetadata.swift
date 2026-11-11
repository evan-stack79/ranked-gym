import AlarmKit
import Foundation

/// Shared AlarmKit metadata (empty) — compiled into App + RestTimerLiveActivityWidget.
@available(iOS 26.0, *)
public struct RankedGymAlarmMetadata: AlarmMetadata, Codable, Hashable, Sendable {
    public init() {}
}
