import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct RestTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var remainingSec: Int
        var totalSec: Int
        var subtitle: String
    }

    var title: String
}
