import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Palette (maquettes DI)

private let colorRed = Color(red: 1, green: 0x2B / 255, blue: 0x2B / 255) // #FF2B2B
private let colorTrack = Color(red: 0x3A / 255, green: 0x3A / 255, blue: 0x3C / 255) // #3A3A3C
private let colorGreen = Color(red: 0x30 / 255, green: 0xD1 / 255, blue: 0x58 / 255) // #30D158
private let colorOrange = Color(red: 1, green: 0x9F / 255, blue: 0x0A / 255) // #FF9F0A
private let colorGold = Color(red: 1, green: 0xD6 / 255, blue: 0x0A / 255) // #FFD60A
private let colorPauseBg = Color(red: 0x2C / 255, green: 0x2C / 255, blue: 0x2E / 255) // #2C2C2E
private let colorStopBg = Color(red: 0x5A / 255, green: 0x14 / 255, blue: 0x14 / 255) // #5A1414
private let colorGray = Color(red: 0x8E / 255, green: 0x8E / 255, blue: 0x93 / 255) // #8E8E93

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

// MARK: - Compact / minimal

private struct CompactLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            Text("S\(state.setIndex)/\(max(1, state.setTotal))")
                .font(.caption2.bold())
                .monospacedDigit()
                .foregroundStyle(colorRed)
        case "steps":
            StepsRing(state: state, line: 2.5)
                .frame(width: 18, height: 18)
        case "record":
            Text("PR")
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(colorOrange)
                .clipShape(Capsule())
        case "rank":
            RankDiamond()
                .frame(width: 14, height: 14)
        default:
            RestRing(state: state, line: 2.5)
                .frame(width: 18, height: 18)
        }
    }
}

private struct CompactTrailing: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            SessionElapsedText(state: state, font: .caption2.bold())
                .foregroundStyle(.white)
        case "steps":
            Text("\(state.steps)")
                .font(.caption2.bold())
                .monospacedDigit()
                .foregroundStyle(colorGreen)
        case "record":
            Text(state.alertTitle.isEmpty ? "+0 kg" : state.alertTitle)
                .font(.caption2.bold())
                .foregroundStyle(colorOrange)
                .lineLimit(1)
        case "rank":
            Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                .font(.caption2.bold())
                .foregroundStyle(colorGold)
                .lineLimit(1)
        default:
            RestCountdownText(state: state, font: .caption2.bold(), color: colorRed)
        }
    }
}

private struct MinimalBadge: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            Text("S\(state.setIndex)")
                .font(.system(size: 10, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(colorRed)
        case "steps":
            StepsRing(state: state, line: 2.5)
                .frame(width: 18, height: 18)
        case "record":
            Text("PR")
                .font(.system(size: 8, weight: .heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(colorOrange)
                .clipShape(Capsule())
        case "rank":
            RankDiamond()
                .frame(width: 14, height: 14)
        default:
            RestRing(state: state, line: 2.5)
                .frame(width: 18, height: 18)
        }
    }
}

// MARK: - Expanded regions

private struct ExpandedLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "rest":
            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityPauseIntent()) {
                    ZStack {
                        Circle().fill(colorPauseBg).frame(width: 40, height: 40)
                        Image(systemName: state.paused ? "play.fill" : "pause.fill")
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
            }
        case "session":
            SessionSetBars(state: state)
        case "steps":
            StepsRing(state: state, line: 4)
                .frame(width: 44, height: 44)
        case "record":
            Text("PR")
                .font(.caption.weight(.heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(colorOrange)
                .clipShape(Capsule())
        case "rank":
            RankDiamond()
                .frame(width: 28, height: 28)
        default:
            EmptyView()
        }
    }
}

private struct ExpandedCenter: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            VStack(spacing: 2) {
                Text("\(formatKg(state.weightKg)) kg × \(state.reps)")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                SessionSetBars(state: state)
                    .frame(maxWidth: 120)
            }
        case "steps":
            VStack(spacing: 2) {
                Text("\(stepsPercent(state)) %")
                    .font(.title3.bold())
                    .monospacedDigit()
                    .foregroundStyle(colorGreen)
                Text("Objectif : \(state.stepsGoal)")
                    .font(.caption2)
                    .foregroundStyle(colorGray)
                Text("Encore \(max(0, state.stepsGoal - state.steps)) pas")
                    .font(.caption2)
                    .foregroundStyle(.white)
            }
        case "record":
            Text(state.alertBody.isEmpty ? state.exerciseName : state.alertBody)
                .font(.headline.bold())
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        case "rank":
            VStack(spacing: 2) {
                Text("Nouveau rang !")
                    .font(.headline.bold())
                    .foregroundStyle(colorGold)
                Text(state.alertTitle)
                    .font(.caption)
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
        default:
            VStack(spacing: 4) {
                Text(restNextSeriesLabel(state))
                    .font(.caption2)
                    .foregroundStyle(colorGray)
                    .lineLimit(1)
                RestCountdownText(
                    state: state,
                    font: .system(size: 36, weight: .bold, design: .rounded),
                    color: .white
                )
                Text(restExerciseLabel(state))
                    .font(.caption2)
                    .foregroundStyle(colorGray)
                    .lineLimit(1)
            }
        }
    }
}

private struct ExpandedTrailing: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "rest":
            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityStopIntent()) {
                    ZStack {
                        Circle().fill(colorStopBg).frame(width: 40, height: 40)
                        Image(systemName: "xmark")
                            .font(.body.bold())
                            .foregroundStyle(colorRed)
                    }
                }
                .buttonStyle(.plain)
            }
        case "session":
            SessionElapsedText(state: state, font: .caption.bold())
                .foregroundStyle(colorGray)
        case "record":
            Text(state.alertTitle.isEmpty ? "+0 kg" : state.alertTitle)
                .font(.caption.bold())
                .foregroundStyle(colorOrange)
        case "rank":
            Text(state.alertTitle)
                .font(.caption.bold())
                .foregroundStyle(colorGold)
                .lineLimit(1)
        default:
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
                HStack {
                    Spacer(minLength: 0)
                    Button(intent: LiveActivityAdd15Intent()) {
                        Text("+15 s")
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(colorPauseBg)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                }
                .padding(.top, 2)
            case "session":
                HStack {
                    Spacer(minLength: 0)
                    Button(intent: LiveActivityValidateIntent()) {
                        Text("Valider")
                            .font(.caption.bold())
                            .foregroundStyle(.black)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(colorGreen)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 2)
            default:
                EmptyView()
            }
        }
    }
}

// MARK: - Lock screen

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
                case "record":
                    RecordLockView(state: state)
                case "rank":
                    RankLockView(state: state)
                default:
                    RestLockView(state: state)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .activityBackgroundTint(Color.black)
    }
}

private struct RestLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        VStack(spacing: 10) {
            Text(restNextSeriesLabel(state))
                .font(.caption)
                .foregroundStyle(colorGray)
            RestCountdownText(
                state: state,
                font: .system(size: 40, weight: .bold, design: .rounded),
                color: .white
            )
            Text(restExerciseLabel(state))
                .font(.caption)
                .foregroundStyle(colorGray)
            if #available(iOS 17.0, *) {
                HStack(spacing: 20) {
                    Button(intent: LiveActivityPauseIntent()) {
                        ZStack {
                            Circle().fill(colorPauseBg).frame(width: 40, height: 40)
                            Image(systemName: state.paused ? "play.fill" : "pause.fill")
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    Button(intent: LiveActivityAdd15Intent()) {
                        Text("+15 s")
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(colorPauseBg)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    Button(intent: LiveActivityStopIntent()) {
                        ZStack {
                            Circle().fill(colorStopBg).frame(width: 40, height: 40)
                            Image(systemName: "xmark")
                                .font(.body.bold())
                                .foregroundStyle(colorRed)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(colorRed, lineWidth: 2)
        )
    }
}

private struct SessionLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Spacer(minLength: 0)
                SessionElapsedText(state: state, font: .caption.bold())
                    .foregroundStyle(colorGray)
            }
            Text("\(formatKg(state.weightKg)) kg × \(state.reps)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            SessionSetBars(state: state)
            if #available(iOS 17.0, *) {
                HStack {
                    Spacer(minLength: 0)
                    Button(intent: LiveActivityValidateIntent()) {
                        Text("Valider")
                            .font(.caption.bold())
                            .foregroundStyle(.black)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(colorGreen)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct StepsLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 14) {
            StepsRing(state: state, line: 5)
                .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(stepsPercent(state)) %")
                    .font(.title3.bold())
                    .monospacedDigit()
                    .foregroundStyle(colorGreen)
                Text("Objectif : \(state.stepsGoal)")
                    .font(.caption)
                    .foregroundStyle(colorGray)
                Text("Encore \(max(0, state.stepsGoal - state.steps)) pas")
                    .font(.caption)
                    .foregroundStyle(.white)
            }
            Spacer(minLength: 0)
            Text("\(state.steps)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorGreen)
        }
    }
}

private struct RecordLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("PR")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(colorOrange)
                    .clipShape(Capsule())
                Text(state.alertTitle.isEmpty ? "+0 kg" : state.alertTitle)
                    .font(.caption.bold())
                    .foregroundStyle(colorOrange)
                Spacer(minLength: 0)
            }
            Text(state.alertBody.isEmpty ? state.exerciseName : state.alertBody)
                .font(.title3.bold())
                .foregroundStyle(.white)
                .lineLimit(2)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(colorOrange, lineWidth: 2)
        )
    }
}

private struct RankLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 12) {
            RankDiamond()
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text("Nouveau rang !")
                    .font(.headline.bold())
                    .foregroundStyle(colorGold)
                Text(state.alertTitle)
                    .font(.caption)
                    .foregroundStyle(.white)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(colorGold, lineWidth: 2)
        )
    }
}

// MARK: - Shared pieces

/// Rest ring: ProgressView(timerInterval: start…end) + piste #3A3A3C, départ midi.
private struct RestRing: View {
    let state: RankedGymLiveAttributes.ContentState
    var line: CGFloat = 3

    var body: some View {
        ZStack {
            Circle()
                .stroke(colorTrack, lineWidth: line)
            if state.paused || state.endDateMs <= 0 {
                Circle()
                    .trim(from: 0, to: restProgressPaused(state))
                    .stroke(colorRed, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            } else if let range = restTimerRange(state) {
                ProgressView(timerInterval: range, countsDown: true)
                    .progressViewStyle(.circular)
                    .tint(colorRed)
            }
        }
    }
}

private struct StepsRing: View {
    let state: RankedGymLiveAttributes.ContentState
    var line: CGFloat = 3

    var body: some View {
        let p = stepsProgress(state)
        ZStack {
            Circle().stroke(colorTrack, lineWidth: line)
            Circle()
                .trim(from: 0, to: p)
                .stroke(colorGreen, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

private struct SessionSetBars: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        let total = max(1, state.setTotal)
        let done = max(0, min(total, state.setIndex - 1)) // séries faites
        HStack(spacing: 4) {
            ForEach(0..<total, id: \.self) { i in
                Capsule()
                    .fill(i < done ? colorRed : colorTrack)
                    .frame(height: 6)
            }
        }
    }
}

private struct SessionElapsedText: View {
    let state: RankedGymLiveAttributes.ContentState
    let font: Font

    var body: some View {
        if state.startedAtMs > 0 {
            let start = Date(timeIntervalSince1970: state.startedAtMs / 1000.0)
            // Compte vers le haut depuis startedAtMs (durée de séance).
            Text(start, style: .timer)
                .font(font)
                .monospacedDigit()
        } else {
            Text("0:00")
                .font(font)
                .monospacedDigit()
        }
    }
}

private struct RankDiamond: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(colorGold)
            .rotationEffect(.degrees(45))
    }
}

/// Chrono repos `m:ss` (ex. `1:12`, pas `01:12`).
private struct RestCountdownText: View {
    let state: RankedGymLiveAttributes.ContentState
    let font: Font
    var color: Color = .white

    var body: some View {
        Group {
            if state.paused || state.endDateMs <= 0 {
                Text(formatClockMss(state.remainingSec))
            } else if let range = restTimerRange(state) {
                // System timer; paused path uses m:ss. Running uses timerInterval.
                Text(timerInterval: range, countsDown: true, showsHours: false)
            } else {
                Text(formatClockMss(state.remainingSec))
            }
        }
        .font(font)
        .monospacedDigit()
        .foregroundStyle(color)
    }
}

// MARK: - Helpers

private func restTimerRange(_ state: RankedGymLiveAttributes.ContentState) -> ClosedRange<Date>? {
    guard !state.paused, state.endDateMs > 0 else { return nil }
    let end = Date(timeIntervalSince1970: state.endDateMs / 1000.0)
    let start: Date
    if state.startDateMs > 0 {
        start = Date(timeIntervalSince1970: state.startDateMs / 1000.0)
    } else {
        start = end.addingTimeInterval(-TimeInterval(max(1, state.totalSec)))
    }
    if end <= start {
        return start...start.addingTimeInterval(0.001)
    }
    return start...end
}

private func restProgressPaused(_ state: RankedGymLiveAttributes.ContentState) -> CGFloat {
    let total = max(1, state.totalSec)
    return CGFloat(max(0, min(1, Double(state.remainingSec) / Double(total))))
}

private func formatClockMss(_ totalSec: Int) -> String {
    let s = max(0, totalSec)
    return "\(s / 60):\(String(format: "%02d", s % 60))"
}

private func formatKg(_ kg: Double) -> String {
    if kg == floor(kg) { return String(Int(kg)) }
    return String(format: "%g", kg)
}

private func stepsProgress(_ state: RankedGymLiveAttributes.ContentState) -> CGFloat {
    let goal = max(1, state.stepsGoal)
    return CGFloat(max(0, min(1, Double(state.steps) / Double(goal))))
}

private func stepsPercent(_ state: RankedGymLiveAttributes.ContentState) -> Int {
    let goal = max(1, state.stepsGoal)
    return Int((Double(state.steps) / Double(goal) * 100).rounded())
}

/// « Série X sur Y ensuite » — setIndex = prochaine série (1-based) quand kind rest.
private func restNextSeriesLabel(_ state: RankedGymLiveAttributes.ContentState) -> String {
    let x = max(1, state.setIndex)
    let y = max(x, state.setTotal)
    return "Série \(x) sur \(y) ensuite"
}

private func restExerciseLabel(_ state: RankedGymLiveAttributes.ContentState) -> String {
    let name = state.exerciseName.isEmpty
        ? (state.subtitle.isEmpty ? "Exercice" : state.subtitle)
        : state.exerciseName
    // Prefer clean "Repos · Name" even if subtitle was "Name · S1".
    if !state.exerciseName.isEmpty {
        return "Repos · \(state.exerciseName)"
    }
    if state.subtitle.contains("·") {
        let ex = state.subtitle.split(separator: "·").first.map(String.init)?.trimmingCharacters(in: .whitespaces) ?? name
        return "Repos · \(ex)"
    }
    return "Repos · \(name)"
}

@main
struct RestTimerLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        RankedGymLiveActivityWidget()
    }
}
