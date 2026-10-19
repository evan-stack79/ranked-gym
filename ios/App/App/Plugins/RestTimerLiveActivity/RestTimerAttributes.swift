import ActivityKit
import Foundation

struct RestTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var remainingSec: Int
        var totalSec: Int
        var subtitle: String
    }

    var title: String
}
