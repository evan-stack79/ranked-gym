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

// MARK: - Scale (gen.py px → pt). Grande bulle 784 px ≈ 371 pt → ÷ 2.11
// Anneau pas 99 pt / boutons 66 pt / losange-PR 76 pt : plafonnés (voir DICap) — hauteur DI.

private enum DIScale {
    static let pxPerPt: CGFloat = 784.0 / 371.0
    static func pt(_ px: CGFloat) -> CGFloat { px / pxPerPt }
}

/// Plafonds ActivityKit (région bottom sous l’encoche) — au-delà iOS compresse / coupe.
private enum DICap {
    /// gen.py pause/X = 140 px → 66 pt ; DI bottom ≈ 80–100 pt utiles.
    static let restButton: CGFloat = 56
    /// gen.py anneau pas = 210 px → 99 pt ; trop haut pour bottom → 72 pt.
    static let stepsRing: CGFloat = 72
    /// gen.py rond PR / losange ≈ 160 px → 76 pt → 64 pt.
    static let badge: CGFloat = 64
}

/// Cadres maquettes 01 / 04 / 05 uniquement (gen.py `outline=…, width=8` → ÷ 2.11).
private enum DIFrame {
    static let lineWidth: CGFloat = DIScale.pt(8) // ≈ 3.8 pt
    static let cornerRadius: CGFloat = DIScale.pt(50) // ≈ 23.7 pt
}

struct RankedGymLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RankedGymLiveAttributes.self) { context in
            LockScreenLiveView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                // M1 : leading/trailing vides — iOS empile center sous la caméra.
                DynamicIslandExpandedRegion(.leading) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.center) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EmptyView()
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

// MARK: - Compact (maquettes 01–05 petit)

private struct CompactLeading: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            Text("S\(state.setIndex)/\(max(1, state.setTotal))")
                .font(.system(size: DIScale.pt(30), weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorRed)
        case "steps":
            StepsRing(state: state, line: 3, showPercent: false, percentFont: 10)
                .frame(width: DIScale.pt(44), height: DIScale.pt(44))
        case "record":
            Text("PR")
                .font(.system(size: DIScale.pt(24), weight: .heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(colorOrange)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        case "rank":
            RankDiamond(glyph: nil, glyphSize: 10)
                .frame(width: DIScale.pt(28), height: DIScale.pt(28))
        default:
            RestRing(state: state, line: 3)
                .frame(width: DIScale.pt(44), height: DIScale.pt(44))
        }
    }
}

private struct CompactTrailing: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        switch state.kind {
        case "session":
            SessionElapsedText(
                state: state,
                font: .system(size: DIScale.pt(30), weight: .bold, design: .rounded)
            )
            .foregroundStyle(.white)
        case "steps":
            Text(formatStepsCount(state.steps))
                .font(.system(size: DIScale.pt(32), weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorGreen)
        case "record":
            Text(state.alertTitle.isEmpty ? "+0 kg" : state.alertTitle)
                .font(.system(size: DIScale.pt(32), weight: .bold))
                .foregroundStyle(colorOrange)
                .lineLimit(1)
        case "rank":
            Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                .font(.system(size: DIScale.pt(32), weight: .bold))
                .foregroundStyle(colorGold)
                .lineLimit(1)
        default:
            RestCountdownText(
                state: state,
                font: .system(size: DIScale.pt(34), weight: .bold, design: .rounded),
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
                .font(.system(size: DIScale.pt(26), weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colorRed)
        case "steps":
            StepsRing(state: state, line: 3, showPercent: false, percentFont: 10)
                .frame(width: DIScale.pt(44), height: DIScale.pt(44))
        case "record":
            Text("PR")
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(.black)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(colorOrange)
                .clipShape(Capsule())
        case "rank":
            RankDiamond(glyph: nil, glyphSize: 10)
                .frame(width: DIScale.pt(28), height: DIScale.pt(28))
        default:
            RestRing(state: state, line: 3)
                .frame(width: DIScale.pt(44), height: DIScale.pt(44))
        }
    }
}

// MARK: - Expanded bottom (M1 : une seule HStack — icônes/boutons à côté du texte)

private struct ExpandedBottom: View {
    let state: RankedGymLiveAttributes.ContentState

    var body: some View {
        switch state.kind {
        case "session":
            ExpandedSessionRow(state: state)
        case "steps":
            ExpandedStepsRow(state: state)
        case "record":
            ExpandedRecordRow(state: state)
        case "rank":
            ExpandedRankRow(state: state)
        default:
            ExpandedRestRow(state: state)
        }
    }
}

/// Maquette 01 — texte à gauche, Pause + X à droite ; cadre rouge (gen.py outline).
private struct ExpandedRestRow: View {
    let state: RankedGymLiveAttributes.ContentState
    private let btn = DICap.restButton

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(spacing: 2) {
                if !restNextSeriesLabel(state).isEmpty {
                    Text(restNextSeriesLabel(state))
                        .font(.system(size: DIScale.pt(24), weight: .semibold))
                        .foregroundStyle(colorGray)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                RestCountdownText(
                    state: state,
                    font: .system(size: DIScale.pt(96), weight: .bold, design: .rounded),
                    color: .white
                )
                .minimumScaleFactor(0.55)
                .lineLimit(1)
                Text(restExerciseLabel(state))
                    .font(.system(size: DIScale.pt(24), weight: .semibold))
                    .foregroundStyle(colorGray)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityPauseIntent()) {
                    ZStack {
                        Circle().fill(colorPauseBg).frame(width: btn, height: btn)
                        Image(systemName: state.paused ? "play.fill" : "pause.fill")
                            .font(.system(size: btn * 0.32, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)

                Button(intent: LiveActivityStopIntent()) {
                    ZStack {
                        Circle().fill(colorStopBg).frame(width: btn, height: btn)
                        Image(systemName: "xmark")
                            .font(.system(size: btn * 0.3, weight: .bold))
                            .foregroundStyle(colorRed)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .overlay(
            RoundedRectangle(cornerRadius: DIFrame.cornerRadius, style: .continuous)
                .stroke(colorRed, lineWidth: DIFrame.lineWidth)
        )
    }
}

/// Maquette 02 — densifié dans bottom.
private struct ExpandedSessionRow: View {
    let state: RankedGymLiveAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(state.exerciseName.isEmpty ? "Séance" : state.exerciseName)
                    .font(.system(size: DIScale.pt(40), weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 6)
                SessionElapsedText(
                    state: state,
                    font: .system(size: DIScale.pt(30), weight: .semibold, design: .rounded)
                )
                .foregroundStyle(colorGray)
            }
            Text(sessionSeriesLabel(state))
                .font(.system(size: DIScale.pt(30), weight: .semibold))
                .foregroundStyle(colorRed)
            HStack(alignment: .center, spacing: 8) {
                Text("\(formatKg(state.weightKg)) kg × \(state.reps) reps")
                    .font(.system(size: DIScale.pt(56), weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if #available(iOS 17.0, *) {
                    Button(intent: LiveActivityValidateIntent()) {
                        Text("Valider")
                            .font(.system(size: DIScale.pt(30), weight: .bold))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 12)
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

/// Maquette 03 — texte à gauche, anneau à droite (même ligne).
private struct ExpandedStepsRow: View {
    let state: RankedGymLiveAttributes.ContentState
    private let ring = DICap.stepsRing

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("\(formatStepsCount(state.steps)) pas")
                    .font(.system(size: DIScale.pt(64), weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                if state.stepsGoal > 0 {
                    Text("Objectif : \(formatStepsCount(state.stepsGoal))")
                        .font(.system(size: DIScale.pt(30), weight: .semibold))
                        .foregroundStyle(colorGray)
                        .minimumScaleFactor(0.8)
                        .lineLimit(1)
                }
                Text("Encore \(formatStepsCount(max(0, state.stepsGoal - state.steps))) pas")
                    .font(.system(size: DIScale.pt(30), weight: .semibold))
                    .foregroundStyle(colorGreen)
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            StepsRing(
                state: state,
                line: max(6, ring * 0.12),
                showPercent: true,
                percentFont: DIScale.pt(40)
            )
            .frame(width: ring, height: ring)
        }
    }
}

/// Maquette 04 — texte à gauche, rond PR à droite ; cadre orange (gen.py outline).
private struct ExpandedRecordRow: View {
    let state: RankedGymLiveAttributes.ContentState
    private let badge = DICap.badge

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Nouveau record !")
                    .font(.system(size: DIScale.pt(36), weight: .bold))
                    .foregroundStyle(colorOrange)
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
                Text(state.alertBody.isEmpty ? state.exerciseName : state.alertBody)
                    .font(.system(size: DIScale.pt(60), weight: .bold))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                Text(recordDeltaCaption(state))
                    .font(.system(size: DIScale.pt(26), weight: .semibold))
                    .foregroundStyle(colorGray)
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            ZStack {
                Circle().fill(colorPrCircle).frame(width: badge, height: badge)
                Text("PR")
                    .font(.system(size: badge * 0.36, weight: .heavy))
                    .foregroundStyle(colorOrange)
            }
        }
        .padding(10)
        .overlay(
            RoundedRectangle(cornerRadius: DIFrame.cornerRadius, style: .continuous)
                .stroke(colorOrange, lineWidth: DIFrame.lineWidth)
        )
    }
}

/// Maquette 05 — texte à gauche, losange à droite ; cadre or (gen.py outline).
private struct ExpandedRankRow: View {
    let state: RankedGymLiveAttributes.ContentState
    private let badge = DICap.badge

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Nouveau rang !")
                    .font(.system(size: DIScale.pt(36), weight: .bold))
                    .foregroundStyle(colorGold)
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
                Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                    .font(.system(size: DIScale.pt(72), weight: .bold))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text(state.alertBody.isEmpty ? "Grâce à tes entraînements" : state.alertBody)
                    .font(.system(size: DIScale.pt(26), weight: .semibold))
                    .foregroundStyle(colorGray)
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            RankDiamond(glyph: rankGlyph(state.alertTitle), glyphSize: badge * 0.32)
                .frame(width: badge, height: badge)
        }
        .padding(10)
        .overlay(
            RoundedRectangle(cornerRadius: DIFrame.cornerRadius, style: .continuous)
                .stroke(colorGold, lineWidth: DIFrame.lineWidth)
        )
    }
}

// MARK: - Lock screen (cadres 01/04/05 comme gen.py ; pas de cadre 02/03)

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
    private let btn = DIScale.pt(140) // gen.py r70 → Ø140 ; lock a plus de place que DI

    var body: some View {
        HStack(spacing: 12) {
            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityPauseIntent()) {
                    ZStack {
                        Circle().fill(colorPauseBg).frame(width: min(btn, 66), height: min(btn, 66))
                        Image(systemName: state.paused ? "play.fill" : "pause.fill")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
            }
            VStack(spacing: 4) {
                if !restNextSeriesLabel(state).isEmpty {
                    Text(restNextSeriesLabel(state))
                        .font(.system(size: DIScale.pt(24), weight: .semibold))
                        .foregroundStyle(colorGray)
                }
                RestCountdownText(
                    state: state,
                    font: .system(size: DIScale.pt(96), weight: .bold, design: .rounded),
                    color: .white
                )
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                Text(restExerciseLabel(state))
                    .font(.system(size: DIScale.pt(24), weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            .frame(maxWidth: .infinity)
            if #available(iOS 17.0, *) {
                Button(intent: LiveActivityStopIntent()) {
                    ZStack {
                        Circle().fill(colorStopBg).frame(width: min(btn, 66), height: min(btn, 66))
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(colorRed)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: DIFrame.cornerRadius, style: .continuous)
                .stroke(colorRed, lineWidth: DIFrame.lineWidth)
        )
    }
}

private struct SessionLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(state.exerciseName.isEmpty ? "Séance" : state.exerciseName)
                    .font(.system(size: DIScale.pt(40), weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                SessionElapsedText(
                    state: state,
                    font: .system(size: DIScale.pt(30), weight: .semibold)
                )
                .foregroundStyle(colorGray)
            }
            Text(sessionSeriesLabel(state))
                .font(.system(size: DIScale.pt(30), weight: .semibold))
                .foregroundStyle(colorRed)
            HStack {
                Text("\(formatKg(state.weightKg)) kg × \(state.reps) reps")
                    .font(.system(size: DIScale.pt(56), weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if #available(iOS 17.0, *) {
                    Button(intent: LiveActivityValidateIntent()) {
                        Text("Valider")
                            .font(.system(size: DIScale.pt(30), weight: .bold))
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
    private let ring = DIScale.pt(210)

    var body: some View {
        HStack(spacing: 14) {
            StepsRing(
                state: state,
                line: max(8, ring * 0.09),
                showPercent: true,
                percentFont: DIScale.pt(40)
            )
            .frame(width: min(ring, 88), height: min(ring, 88))
            VStack(alignment: .leading, spacing: 4) {
                Text("\(formatStepsCount(state.steps)) pas")
                    .font(.system(size: DIScale.pt(64), weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                if state.stepsGoal > 0 {
                    Text("Objectif : \(formatStepsCount(state.stepsGoal))")
                        .font(.system(size: DIScale.pt(30), weight: .semibold))
                        .foregroundStyle(colorGray)
                }
                Text("Encore \(formatStepsCount(max(0, state.stepsGoal - state.steps))) pas")
                    .font(.system(size: DIScale.pt(30), weight: .semibold))
                    .foregroundStyle(colorGreen)
            }
            Spacer(minLength: 0)
        }
    }
}

private struct RecordLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    private let badge = min(DIScale.pt(160), 76)

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(colorPrCircle).frame(width: badge, height: badge)
                Text("PR")
                    .font(.system(size: badge * 0.35, weight: .heavy))
                    .foregroundStyle(colorOrange)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Nouveau record !")
                    .font(.system(size: DIScale.pt(36), weight: .bold))
                    .foregroundStyle(colorOrange)
                Text(state.alertBody.isEmpty ? state.exerciseName : state.alertBody)
                    .font(.system(size: DIScale.pt(60), weight: .bold))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                Text(recordDeltaCaption(state))
                    .font(.system(size: DIScale.pt(26), weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: DIFrame.cornerRadius, style: .continuous)
                .stroke(colorOrange, lineWidth: DIFrame.lineWidth)
        )
    }
}

private struct RankLockView: View {
    let state: RankedGymLiveAttributes.ContentState
    private let badge = min(DIScale.pt(160), 76)

    var body: some View {
        HStack(spacing: 14) {
            RankDiamond(glyph: rankGlyph(state.alertTitle), glyphSize: badge * 0.32)
                .frame(width: badge, height: badge)
            VStack(alignment: .leading, spacing: 4) {
                Text("Nouveau rang !")
                    .font(.system(size: DIScale.pt(36), weight: .bold))
                    .foregroundStyle(colorGold)
                Text(state.alertTitle.isEmpty ? "Rang" : state.alertTitle)
                    .font(.system(size: DIScale.pt(72), weight: .bold))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text(state.alertBody.isEmpty ? "Grâce à tes entraînements" : state.alertBody)
                    .font(.system(size: DIScale.pt(26), weight: .semibold))
                    .foregroundStyle(colorGray)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .overlay(
            RoundedRectangle(cornerRadius: DIFrame.cornerRadius, style: .continuous)
                .stroke(colorGold, lineWidth: DIFrame.lineWidth)
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
    var percentFont: CGFloat = 11

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
                    .font(.system(size: percentFont, weight: .bold, design: .rounded))
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
    var glyphSize: CGFloat = 12
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(colorGold)
                .rotationEffect(.degrees(45))
            if let glyph, !glyph.isEmpty {
                Text(glyph)
                    .font(.system(size: glyphSize, weight: .heavy))
                    .foregroundStyle(.black)
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
    if s.count <= 4 { return s }
    return nil
}

@main
struct RestTimerLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        RankedGymLiveActivityWidget()
    }
}
