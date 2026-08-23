import ActivityKit
import SwiftUI
import WidgetKit

struct RestTimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            RestTimerLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "timer")
                        .foregroundStyle(Color.red)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text("Temps de repos")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(formatClock(context.state.remainingSec))
                            .font(.title2.bold())
                            .monospacedDigit()
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.remainingSec)s")
                        .font(.caption.bold())
                        .foregroundStyle(Color.red)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(Color.red)
            } compactTrailing: {
                Text(formatClock(context.state.remainingSec))
                    .font(.caption2.bold())
                    .monospacedDigit()
                    .foregroundStyle(.white)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(Color.red)
            }
        }
    }
}

private struct RestTimerLockScreenView: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.05, green: 0.05, blue: 0.06), Color(red: 0.12, green: 0.05, blue: 0.06)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .stroke(Color.red.opacity(0.35), lineWidth: 4)
                        .frame(width: 52, height: 52)
                    Image(systemName: "timer")
                        .foregroundStyle(Color.red)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Temps de repos")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                    Text(context.state.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                Text(formatClock(context.state.remainingSec))
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.red)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .activityBackgroundTint(Color.black.opacity(0.85))
    }
}

private func formatClock(_ totalSec: Int) -> String {
    let s = max(0, totalSec)
    let m = s / 60
    let r = s % 60
    return String(format: "%02d:%02d", m, r)
}

@main
struct RestTimerLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        RestTimerLiveActivityWidget()
    }
}
