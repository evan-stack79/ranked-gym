import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

/// Live Activity for AlarmKit countdown / snooze (Répéter 9 min).
@available(iOS 26.0, *)
struct RankedAlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<RankedGymAlarmMetadata>.self) { context in
            RankedAlarmLockScreen()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "alarm.fill")
                        .foregroundStyle(Color(red: 0.67, green: 0.70, blue: 0.73))
                }
                DynamicIslandExpandedRegion(.center) {
                    Text("Réveil")
                        .font(.headline)
                        .foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EmptyView()
                }
            } compactLeading: {
                Image(systemName: "alarm.fill")
                    .foregroundStyle(Color(red: 0.67, green: 0.70, blue: 0.73))
            } compactTrailing: {
                Text("Réveil")
                    .font(.caption2)
                    .foregroundStyle(.white)
            } minimal: {
                Image(systemName: "alarm.fill")
            }
        }
    }
}

@available(iOS 26.0, *)
private struct RankedAlarmLockScreen: View {
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "alarm.fill")
                .font(.title2)
                .foregroundStyle(Color(red: 172 / 255, green: 180 / 255, blue: 186 / 255))
            VStack(alignment: .leading, spacing: 2) {
                Text("Réveil")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("Ranked Gym")
                    .font(.caption)
                    .foregroundStyle(Color(red: 172 / 255, green: 180 / 255, blue: 186 / 255))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .activityBackgroundTint(Color.black.opacity(0.92))
    }
}
