import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Palette (gen.py / maquettes 01–06)

private let colorRed = Color(red: 1, green: 0x2B / 255, blue: 0x2B / 255) // #FF2B2B
private let colorTrack = Color(red: 0x3A / 255, green: 0x3A / 255, blue: 0x3C / 255) // #3A3A3C
private let colorGreen = Color(red: 0x30 / 255, green: 0xD1 / 255, blue: 0x58 / 255) // #30D158
private let colorOrange = Color(red: 1, green: 0x9F / 255, blue: 0x0A / 255) // #FF9F0A
private let colorGold = Color(red: 1, green: 0xD6 / 255, blue: 0x0A / 255) // #FFD60A
private let colorPauseBg = Color(red: 0x2C / 255, green: 0x2C / 255, blue: 0x2E / 255) // #2C2C2E
private let colorStopBg = Color(red: 0x5A / 255, green: 0x14 / 255, blue: 0x14 / 255) // #5A1414
private let colorGray = Color(red: 0x8E / 255, green: 0x8E / 255, blue: 0x93 / 255) // #8E8E93
private let colorPrCircle = Color(red: 0x3D / 255, green: 0x2A / 255, blue: 0x05 / 255) // #3D2A05

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
                // Maquette 06 — anneau seul (repos) / « S2 » (séance)
                MinimalBadge(state: context.state)
            }
        }
    }
}

// MARK: - Compact (maquettes 01–05 petit)

private struct CompactLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            Text("S\(state.setIndex)/\(max(1, state.setTotal))")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorRed)
        case "steps":
            StepsRing(state: state, line: 3, showPercent: false)
                .frame(width: 20, height: 20)
        case "record":
            Text("PR")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(colorOrange)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        case "rank":
            RankDiamond(glyph: nil)
                .frame(width: 14, height: 14)
        default:
            // Anneau seul — pas de chrono au centre (évite le double « 1:17 » d’Evan)
            RestRing(state: state, line: 3)
                .frame(width: 20, height: 20)
        }
    }
}

private struct CompactTrailing: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            SessionElapsedText(state: state, font: .system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        case "steps":
            Text(formatStepsCount(state.steps))
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorGreen)
        case "record":
            Text(state.alertTitle.isEmpty ? "+0 kg" : state.alertTitle)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(colorOrange)
                .lineLimit(1)
        case "rank":
            Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(colorGold)
                .lineLimit(1)
        default:
            RestCountdownText(
                state: state,
                font: .system(size: 17, weight: .bold, design: .rounded),
                color: colorRed
            )
        }
    }
}

/// Maquette 06 — minimale uniquement repos (anneau) / séance (S2).
private struct MinimalBadge: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            Text("S\(state.setIndex)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorRed)
        case "steps":
            StepsRing(state: state, line: 3, showPercent: false)
                .frame(width: 20, height: 20)
        case "record":
            Text("PR")
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(colorOrange)
                .clipShape(Capsule())
        case "rank":
            RankDiamond(glyph: nil)
                .frame(width: 14, height: 14)
        default:
            RestRing(state: state, line: 3)
                .frame(width: 20, height: 20)
        }
    }
}

// MARK: - Expanded (basse — pas de cadre rouge DI, pas de +15)

private struct ExpandedLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "rest":
            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityPauseIntent()) {
                    ZStack {
                        Circle().fill(colorPauseBg).frame(width: 36, height: 36)
                        Image(systemName: state.paused ? "play.fill" : "pause.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
            }
        case "steps":
            StepsRing(state: state, line: 5, showPercent: true)
                .frame(width: 48, height: 48)
        case "record":
            ZStack {
                Circle().fill(colorPrCircle).frame(width: 44, height: 44)
                Text("PR")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(colorOrange)
            }
        case "rank":
            RankDiamond(glyph: rankGlyph(state.alertTitle))
                .frame(width: 40, height: 40)
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
            // Maquette 02 — layout horizontal dense (hauteur basse)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(state.exerciseName.isEmpty ? "Séance" : state.exerciseName)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    SessionElapsedText(
                        state: state,
                        font: .system(size: 13, weight: .semibold, design: .rounded)
                    )
                    .foregroundStyle(colorGray)
                }
                Text(sessionSeriesLabel(state))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(colorRed)
                HStack(alignment: .center, spacing: 8) {
                    Text("\(formatKg(state.weightKg)) kg × \(state.reps) reps")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if #available(iOS 17.0, *) {
                        Button(intent: LiveActivityValidateIntent()) {
                            Text("Valider")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.black)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(colorGreen)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                SessionSetBars(state: state)
            }
        case "steps":
            // Maquette 03 — « 6 240 pas » / Objectif / Encore (vert)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(formatStepsCount(state.steps)) pas")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                if state.stepsGoal > 0 {
                    Text("Objectif : \(formatStepsCount(state.stepsGoal))")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(colorGray)
                }
                Text("Encore \(formatStepsCount(max(0, state.stepsGoal - state.steps))) pas")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(colorGreen)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case "record":
            // Maquette 04
            VStack(alignment: .leading, spacing: 2) {
                Text("Nouveau record !")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(colorOrange)
                Text(state.alertBody.isEmpty ? state.exerciseName : state.alertBody)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(recordDeltaCaption(state))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(colorGray)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case "rank":
            // Maquette 05
            VStack(alignment: .leading, spacing: 2) {
                Text("Nouveau rang !")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(colorGold)
                Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(state.alertBody.isEmpty ? "Grâce à tes entraînements" : state.alertBody)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(colorGray)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            // Maquette 01 — centre bas (pas de cadre rouge autour)
            VStack(spacing: 2) {
                if !restNextSeriesLabel(state).isEmpty {
                    Text(restNextSeriesLabel(state))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(colorGray)
                        .lineLimit(1)
                }
                RestCountdownText(
                    state: state,
                    font: .system(size: 34, weight: .bold, design: .rounded),
                    color: .white
                )
                Text(restExerciseLabel(state))
                    .font(.system(size: 11, weight: .semibold))
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
                        Circle().fill(colorStopBg).frame(width: 36, height: 36)
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(colorRed)
                    }
                }
                .buttonStyle(.plain)
            }
        default:
            EmptyView()
        }
    }
}

private struct ExpandedBottom: View {
    let state: RankedGymLiveAttributes.ContentState
    /// Pas de région bottom — réduit la hauteur (maquettes denses).
    var body: some View {
        EmptyView()
    }
}

// MARK: - Lock screen (bordures maquette sur lock uniquement)

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
            .padding(.vertical, 10)
        }
        .activityBackgroundTint(Color.black)
    }
}

private struct RestLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 12) {
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
            VStack(spacing: 4) {
                if !restNextSeriesLabel(state).isEmpty {
                    Text(restNextSeriesLabel(state))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(colorGray)
                }
                RestCountdownText(
                    state: state,
                    font: .system(size: 36, weight: .bold, design: .rounded),
                    color: .white
                )
                Text(restExerciseLabel(state))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            .frame(maxWidth: .infinity)
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
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(colorRed, lineWidth: 2)
        )
    }
}

private struct SessionLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(state.exerciseName.isEmpty ? "Séance" : state.exerciseName)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer(minLength: 0)
                SessionElapsedText(state: state, font: .system(size: 14, weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            Text(sessionSeriesLabel(state))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(colorRed)
            HStack {
                Text("\(formatKg(state.weightKg)) kg × \(state.reps) reps")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Spacer(minLength: 0)
                if #available(iOS 17.0, *) {
                    Button(intent: LiveActivityValidateIntent()) {
                        Text("Valider")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(colorGreen)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            SessionSetBars(state: state)
        }
    }
}

private struct StepsLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 14) {
            StepsRing(state: state, line: 6, showPercent: true)
                .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(formatStepsCount(state.steps)) pas")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                if state.stepsGoal > 0 {
                    Text("Objectif : \(formatStepsCount(state.stepsGoal))")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(colorGray)
                }
                Text("Encore \(formatStepsCount(max(0, state.stepsGoal - state.steps))) pas")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(colorGreen)
            }
            Spacer(minLength: 0)
        }
    }
}

private struct RecordLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(colorPrCircle).frame(width: 52, height: 52)
                Text("PR")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(colorOrange)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Nouveau record !")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(colorOrange)
                Text(state.alertBody.isEmpty ? state.exerciseName : state.alertBody)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(recordDeltaCaption(state))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(colorOrange, lineWidth: 2)
        )
    }
}

private struct RankLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 14) {
            RankDiamond(glyph: rankGlyph(state.alertTitle))
                .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text("Nouveau rang !")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(colorGold)
                Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                Text(state.alertBody.isEmpty ? "Grâce à tes entraînements" : state.alertBody)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(colorGold, lineWidth: 2)
        )
    }
}

// MARK: - Shared pieces

/// Anneau repos : ProgressView(timerInterval:) sans label (évite le chrono dans l’anneau).
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
                ProgressView(timerInterval: range, countsDown: true) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.circular)
                .tint(colorRed)
                // Masque tout résidu de texte système au centre
                .mask(
                    Circle().stroke(Color.white, lineWidth: line * 2.2)
                )
            }
        }
    }
}

private struct StepsRing: View {
    let state: RankedGymLiveAttributes.ContentState
    var line: CGFloat = 3
    var showPercent: Bool = false

    var body: some View {
        let p = stepsProgress(state)
        ZStack {
            Circle().stroke(colorTrack, lineWidth: line)
            Circle()
                .trim(from: 0, to: p)
                .stroke(colorGreen, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if showPercent {
                Text("\(stepsPercent(state)) %")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            }
        }
    }
}

private struct SessionSetBars: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        let total = max(1, state.setTotal)
        let filled = sessionFilledSetBars(setIndex: state.setIndex, setTotal: total)
        HStack(spacing: 4) {
            ForEach(0..<total, id: \.self) { i in
                Capsule()
                    .fill(i < filled ? colorRed : colorTrack)
                    .frame(height: 5)
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
    var glyph: String?
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(colorGold)
                .rotationEffect(.degrees(45))
            if let glyph, !glyph.isEmpty {
                Text(glyph)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(.black)
                    .rotationEffect(.degrees(0))
            }
        }
    }
}

private struct RestCountdownText: View {
    let state: RankedGymLiveAttributes.ContentState
    let font: Font
    var color: Color = .white

    var body: some View {
        Group {
            if state.paused || state.endDateMs <= 0 {
                Text(formatClockMss(state.remainingSec))
            } else if let range = restTimerRange(state) {
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

private func sessionFilledSetBars(setIndex: Int, setTotal: Int) -> Int {
    let total = max(1, setTotal)
    let current = max(0, setIndex)
    return max(0, min(total, current))
}

private func sessionSeriesLabel(_ state: RankedGymLiveAttributes.ContentState) -> String {
    let total = max(1, state.setTotal)
    let x = min(max(1, state.setIndex), total)
    return "Série \(x) sur \(total)"
}

private func restNextSeriesLabel(_ state: RankedGymLiveAttributes.ContentState) -> String {
    let total = state.setTotal
    if total <= 0 { return "" }
    let next = max(1, state.setIndex)
    if next > total { return "Séries terminées" }
    let x = min(next, total)
    return "Série \(x) sur \(total) ensuite"
}

private func formatStepsCount(_ steps: Int) -> String {
    let n = max(0, steps)
    let f = NumberFormatter()
    f.locale = Locale(identifier: "fr_FR")
    f.numberStyle = .decimal
    f.usesGroupingSeparator = true
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

private func restExerciseLabel(_ state: RankedGymLiveAttributes.ContentState) -> String {
    if !state.exerciseName.isEmpty {
        return "Repos · \(state.exerciseName)"
    }
    if state.subtitle.contains("·") {
        let ex = state.subtitle.split(separator: "·").first.map(String.init)?
            .trimmingCharacters(in: .whitespaces) ?? "Exercice"
        return "Repos · \(ex)"
    }
    return state.subtitle.isEmpty ? "Repos · Exercice" : "Repos · \(state.subtitle)"
}

private func recordDeltaCaption(_ state: RankedGymLiveAttributes.ContentState) -> String {
    let delta = state.alertTitle.isEmpty ? "+0 kg" : state.alertTitle
    if state.subtitle.localizedCaseInsensitiveContains("rapport") {
        return state.subtitle
    }
    return "\(delta) par rapport à l'ancien"
}

/// Extrait « II » depuis « Or II » pour le losange (maquette 05).
private func rankGlyph(_ title: String) -> String? {
    let parts = title.split(separator: " ")
    guard let last = parts.last, last != parts.first else { return nil }
    let s = String(last)
    // Chiffre romain ou court suffixe
    if s.count <= 4 { return s }
    return nil
}

@main
struct RestTimerLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        RankedGymLiveActivityWidget()
    }
}
