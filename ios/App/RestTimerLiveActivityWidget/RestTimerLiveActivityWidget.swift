import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

private let accentRed = Color(red: 1.0, green: 43.0 / 255.0, blue: 43.0 / 255.0) // #FF2B2B

struct RankedGymLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RankedGymLiveAttributes.self) { context in
            LockScreenLiveView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ExpandedLeading(state: context.state)
                }
                DynamicIslandExpandedRegion(.center) {
                    ExpandedCenter(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailing(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottom(state: context.state)
                }
            } compactLeading: {
                CompactLeading(state: context.state)
            } compactTrailing: {
                CompactTrailing(state: context.state)
            } minimal: {
                MinimalBadge(state: context.state)
            }
        }
    }
}

// MARK: - Dynamic Island regions

private struct CompactLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "steps":
            Image(systemName: "figure.walk").foregroundStyle(accentRed)
        case "record", "rank":
            Image(systemName: "flame.fill").foregroundStyle(accentRed)
        case "session":
            Image(systemName: "dumbbell.fill").foregroundStyle(accentRed)
        default:
            Image(systemName: "timer").foregroundStyle(accentRed)
        }
    }
}

private struct CompactTrailing: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "steps":
            Text("\(state.steps)")
                .font(.caption2.bold())
                .monospacedDigit()
                .foregroundStyle(.white)
        case "session":
            Text("\(state.setIndex)/\(max(1, state.setTotal))")
                .font(.caption2.bold())
                .monospacedDigit()
                .foregroundStyle(.white)
        case "record", "rank":
            Image(systemName: "sparkles").foregroundStyle(accentRed)
        default:
            Text(formatClock(state.remainingSec))
                .font(.caption2.bold())
                .monospacedDigit()
                .foregroundStyle(.white)
        }
    }
}

private struct MinimalBadge: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        ZStack {
            if state.kind == "rest" {
                Circle()
                    .trim(from: 0, to: restProgress(state))
                    .stroke(accentRed, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 18, height: 18)
            }
            Image(systemName: minimalIcon(state.kind))
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(accentRed)
        }
    }
}

private struct ExpandedLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        if state.kind == "rest" {
            RestRing(progress: restProgress(state), size: 44, line: 4)
        } else {
            Image(systemName: minimalIcon(state.kind))
                .font(.title2)
                .foregroundStyle(accentRed)
        }
    }
}

private struct ExpandedCenter: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            VStack(spacing: 2) {
                Text(state.exerciseName.isEmpty ? "Séance" : state.exerciseName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text("Série \(state.setIndex)/\(max(1, state.setTotal))")
                    .font(.headline.bold())
                    .foregroundStyle(.white)
            }
        case "steps":
            VStack(spacing: 2) {
                Text("Pas du jour")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(state.steps) / \(state.stepsGoal)")
                    .font(.headline.bold().monospacedDigit())
                    .foregroundStyle(.white)
            }
        case "record", "rank":
            VStack(spacing: 2) {
                Text(state.alertTitle)
                    .font(.caption.bold())
                    .foregroundStyle(accentRed)
                    .lineLimit(1)
                Text(state.alertBody)
                    .font(.caption2)
                    .foregroundStyle(.white)
                    .lineLimit(2)
            }
        default:
            VStack(spacing: 2) {
                Text(state.paused ? "Pause" : "Repos")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(formatClock(state.remainingSec))
                    .font(.title2.bold())
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
        }
    }
}

private struct ExpandedTrailing: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        if state.kind == "session" {
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(formatKg(state.weightKg)) kg")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                Text("\(state.reps) reps")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        } else if state.kind == "rest" {
            Text("\(state.remainingSec)s")
                .font(.caption.bold())
                .foregroundStyle(accentRed)
        } else {
            EmptyView()
        }
    }
}

private struct ExpandedBottom: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        if #available(iOS 17.0, *) {
            switch state.kind {
            case "rest":
                HStack(spacing: 16) {
                    Button(intent: LiveActivityPauseIntent()) {
                        ZStack {
                            Circle().fill(Color(white: 0.28)).frame(width: 40, height: 40)
                            Image(systemName: state.paused ? "play.fill" : "pause.fill")
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    Button(intent: LiveActivityStopIntent()) {
                        ZStack {
                            Circle().fill(accentRed).frame(width: 40, height: 40)
                            Image(systemName: "stop.fill")
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                }
                .padding(.top, 4)
            case "session":
                HStack {
                    Spacer(minLength: 0)
                    Button(intent: LiveActivityValidateIntent()) {
                        Text("Valider")
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(accentRed)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 4)
            default:
                EmptyView()
            }
        }
    }
}

// MARK: - Lock screen (same content without Dynamic Island)

private struct LockScreenLiveView: View {
    let state: RankedGymLiveAttributes.ContentState

    var body: some View {
        ZStack {
            Color.black
            Group {
                switch state.kind {
                case "session":
                    SessionLockView(state: state)
                case "steps":
                    StepsLockView(state: state)
                case "record", "rank":
                    AlertLockView(state: state)
                default:
                    RestLockView(state: state)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .activityBackgroundTint(Color.black)
    }
}

private struct RestLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 14) {
            RestRing(progress: restProgress(state), size: 56, line: 5)
            VStack(alignment: .leading, spacing: 4) {
                Text(state.paused ? "Pause" : "Temps de repos")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                if !state.subtitle.isEmpty {
                    Text(state.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Text(formatClock(state.remainingSec))
                .font(.system(size: 32, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
            if #available(iOS 17.0, *) {
                VStack(spacing: 8) {
                    Button(intent: LiveActivityPauseIntent()) {
                        ZStack {
                            Circle().fill(Color(white: 0.28)).frame(width: 36, height: 36)
                            Image(systemName: state.paused ? "play.fill" : "pause.fill")
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    Button(intent: LiveActivityStopIntent()) {
                        ZStack {
                            Circle().fill(accentRed).frame(width: 36, height: 36)
                            Image(systemName: "stop.fill")
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct SessionLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "dumbbell.fill")
                .foregroundStyle(accentRed)
                .font(.title2)
            VStack(alignment: .leading, spacing: 4) {
                Text(state.exerciseName.isEmpty ? "Séance" : state.exerciseName)
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("Série \(state.setIndex)/\(max(1, state.setTotal)) · \(formatKg(state.weightKg)) kg × \(state.reps)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityValidateIntent()) {
                    Text("Valider")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(accentRed)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct StepsLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.walk")
                .foregroundStyle(accentRed)
                .font(.title2)
            VStack(alignment: .leading, spacing: 4) {
                Text("Pas du jour")
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                Text("Objectif choisi · \(state.stepsGoal)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text("\(state.steps)")
                .font(.system(size: 28, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
        }
    }
}

private struct AlertLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "flame.fill")
                .foregroundStyle(accentRed)
                .font(.title2)
            VStack(alignment: .leading, spacing: 4) {
                Text(state.alertTitle)
                    .font(.headline.bold())
                    .foregroundStyle(accentRed)
                Text(state.alertBody)
                    .font(.caption)
                    .foregroundStyle(.white)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
    }
}

private struct RestRing: View {
    let progress: CGFloat
    let size: CGFloat
    let line: CGFloat
    var body: some View {
        ZStack {
            Circle()
                .stroke(accentRed.opacity(0.25), lineWidth: line)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(accentRed, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Helpers

private func restProgress(_ state: RankedGymLiveAttributes.ContentState) -> CGFloat {
    let total = max(1, state.totalSec)
    return CGFloat(max(0, min(1, Double(state.remainingSec) / Double(total))))
}

private func formatClock(_ totalSec: Int) -> String {
    let s = max(0, totalSec)
    return String(format: "%02d:%02d", s / 60, s % 60)
}

private func formatKg(_ kg: Double) -> String {
    if kg == floor(kg) { return String(Int(kg)) }
    return String(format: "%g", kg)
}

private func minimalIcon(_ kind: String) -> String {
    switch kind {
    case "session": return "dumbbell.fill"
    case "steps": return "figure.walk"
    case "record", "rank": return "flame.fill"
    default: return "timer"
    }
}

@main
struct RestTimerLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        RankedGymLiveActivityWidget()
    }
}
