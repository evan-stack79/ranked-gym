import ActivityKit
import SwiftUI
import WidgetKit

private enum RankedColors {
    static let red9 = Color(red: 1, green: 7 / 255, blue: 2 / 255)
    static let red11 = Color(red: 1, green: 144 / 255, blue: 127 / 255)
    static let gray1 = Color.black
    static let gray2 = Color(red: 16 / 255, green: 18 / 255, blue: 20 / 255)
    static let gray3 = Color(red: 29 / 255, green: 31 / 255, blue: 32 / 255)
    static let gray11 = Color(red: 172 / 255, green: 180 / 255, blue: 186 / 255)
    static let gray12 = Color(red: 236 / 255, green: 238 / 255, blue: 239 / 255)
}

struct RestTimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            RestTimerLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "timer")
                        .foregroundStyle(RankedColors.red9)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text("Temps de repos")
                            .font(.caption)
                            .foregroundStyle(RankedColors.gray11)
                        Text(formatClock(context.state.remainingSec))
                            .font(.title2.bold())
                            .monospacedDigit()
                            .foregroundStyle(RankedColors.gray12)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.remainingSec)s")
                        .font(.caption.bold())
                        .foregroundStyle(RankedColors.red9)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(RankedColors.red9)
            } compactTrailing: {
                Text(formatClock(context.state.remainingSec))
                    .font(.caption2.bold())
                    .monospacedDigit()
                    .foregroundStyle(RankedColors.gray12)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(RankedColors.red9)
            }
        }
    }
}

private struct RestTimerLockScreenView: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [RankedColors.gray1, RankedColors.gray2, RankedColors.gray3],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .stroke(RankedColors.red9.opacity(0.35), lineWidth: 4)
                        .frame(width: 52, height: 52)
                    Image(systemName: "timer")
                        .foregroundStyle(RankedColors.red9)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Temps de repos")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(RankedColors.gray12)
                    Text(context.state.subtitle)
                        .font(.caption)
                        .foregroundStyle(RankedColors.gray11)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                Text(formatClock(context.state.remainingSec))
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(RankedColors.red11)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .activityBackgroundTint(RankedColors.gray1.opacity(0.92))
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
