import ActivityKit
import AppIntents
import SwiftUI
import UIKit
import WidgetKit

// MARK: - Brand

private enum RG {
    static let red = Color(red: 1, green: 43 / 255, blue: 43 / 255)
    static let charcoal = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
    static let softGray = Color(red: 174 / 255, green: 174 / 255, blue: 178 / 255)
}

// MARK: - Widget

struct RestTimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            RestTimerLockScreenView(context: context)
                .widgetURL(Self.sessionURL(sessionId: context.attributes.sessionId))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PantherMark(size: 28)
                        .accessibilityHidden(true)
                }
                DynamicIslandExpandedRegion(.center) {
                    ExpandedCenter(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailing(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottom(context: context)
                }
            } compactLeading: {
                PantherMark(size: 18)
                    .accessibilityLabel("Ranked Gym")
            } compactTrailing: {
                CompactTrailing(state: context.state)
            } minimal: {
                PantherMark(size: 14)
                    .accessibilityLabel("Ranked Gym")
            }
            .widgetURL(Self.sessionURL(sessionId: context.attributes.sessionId))
        }
    }

    static func sessionURL(sessionId: String) -> URL {
        var comps = URLComponents()
        comps.scheme = "rankedgym"
        comps.host = "session"
        comps.path = "/active"
        comps.queryItems = [URLQueryItem(name: "sessionId", value: sessionId)]
        return comps.url ?? URL(string: "rankedgym://session/active")!
    }

    static func actionURL(action: String, sessionId: String, delta: Int? = nil) -> URL {
        var items = [
            URLQueryItem(name: "action", value: action),
            URLQueryItem(name: "sessionId", value: sessionId),
            URLQueryItem(name: "token", value: UUID().uuidString),
        ]
        if let delta {
            items.append(URLQueryItem(name: "delta", value: String(delta)))
        }
        var comps = URLComponents()
        comps.scheme = "rankedgym"
        comps.host = "live-activity"
        comps.queryItems = items
        return comps.url ?? URL(string: "rankedgym://live-activity")!
    }
}

// MARK: - Dynamic Island regions

private struct ExpandedCenter: View {
    let state: RestTimerAttributes.ContentState

    var body: some View {
        VStack(spacing: 2) {
            Text("REPOS")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(RG.softGray)
                .accessibilityHidden(true)
            restClock(state: state, font: .system(size: 28, weight: .bold).monospacedDigit())
                .foregroundStyle(.white)
                .accessibilityLabel(restA11y(state))
        }
    }
}

private struct ExpandedTrailing: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                Button(
                    intent: ToggleRestPauseIntent(sessionId: context.attributes.sessionId)
                ) {
                    pauseGlyph(paused: context.state.paused)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(context.state.paused ? "Reprendre le repos" : "Mettre le repos en pause")
            } else {
                Link(destination: RestTimerLiveActivityWidget.actionURL(
                    action: context.state.paused ? "resume" : "pause",
                    sessionId: context.attributes.sessionId
                )) {
                    pauseGlyph(paused: context.state.paused)
                }
                .accessibilityLabel(context.state.paused ? "Reprendre le repos" : "Mettre le repos en pause")
            }
        }
    }

    @ViewBuilder
    private func pauseGlyph(paused: Bool) -> some View {
        ZStack {
            Circle()
                .fill(RG.red)
                .frame(width: 36, height: 36)
            Image(systemName: paused ? "play.fill" : "pause.fill")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
        }
    }
}

private struct ExpandedBottom: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text(context.state.exerciseName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("·")
                    .foregroundStyle(RG.softGray)
                Text(context.state.setLine)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(RG.softGray)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(context.state.exerciseName), \(context.state.setLineVerbose)")

            RestProgressBar(fraction: context.state.progressFraction())

            HStack(spacing: 10) {
                adjustButton(delta: -15, label: "−15 s")
                adjustButton(delta: 15, label: "+15 s")
            }
        }
        .padding(.top, 2)
    }

    @ViewBuilder
    private func adjustButton(delta: Int, label: String) -> some View {
        if #available(iOS 17.0, *) {
            Button(
                intent: AdjustRestIntent(
                    deltaSec: delta,
                    sessionId: context.attributes.sessionId
                )
            ) {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(RG.charcoal, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(delta < 0 ? "Réduire le repos de 15 secondes" : "Augmenter le repos de 15 secondes")
        } else {
            Link(destination: RestTimerLiveActivityWidget.actionURL(
                action: "adjust",
                sessionId: context.attributes.sessionId,
                delta: delta
            )) {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(RG.charcoal, in: Capsule())
            }
            .accessibilityLabel(delta < 0 ? "Réduire le repos de 15 secondes" : "Augmenter le repos de 15 secondes")
        }
    }
}

private struct CompactTrailing: View {
    let state: RestTimerAttributes.ContentState

    var body: some View {
        HStack(spacing: 5) {
            restClock(state: state, font: .system(size: 14, weight: .bold).monospacedDigit())
                .foregroundStyle(.white)
            CompactRing(fraction: state.progressFraction())
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(restA11y(state))
    }
}

// MARK: - Lock Screen

private struct RestTimerLockScreenView: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                PantherMark(size: 22)
                Text("Ranked Gym")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer(minLength: 0)
            }

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.exerciseName)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(context.state.setLineVerbose)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(RG.softGray)
                }
                .accessibilityElement(children: .combine)

                Spacer(minLength: 8)

                restClock(state: context.state, font: .system(size: 34, weight: .bold).monospacedDigit())
                    .foregroundStyle(.white)
                    .accessibilityLabel(restA11y(context.state))
            }

            RestProgressBar(fraction: context.state.progressFraction())

            resumeControl(context: context)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(RG.red)
    }

    @ViewBuilder
    private func resumeControl(context: ActivityViewContext<RestTimerAttributes>) -> some View {
        let paused = context.state.paused
        let label = paused ? "Reprendre" : "Ouvrir la séance"
        let a11y = paused ? "Reprendre le repos et ouvrir la séance" : "Ouvrir la séance active"

        if #available(iOS 17.0, *), paused {
            Button(intent: ToggleRestPauseIntent(sessionId: context.attributes.sessionId)) {
                Text(label)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(RG.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(RG.charcoal, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(a11y)
        } else {
            // Deep link direct séance active (pas home).
            Link(destination: RestTimerLiveActivityWidget.sessionURL(
                sessionId: context.attributes.sessionId
            )) {
                Text("Reprendre")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(RG.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(RG.charcoal, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .accessibilityLabel(a11y)
        }
    }
}

// MARK: - Shared bits

private struct PantherMark: View {
    let size: CGFloat

    var body: some View {
        // Asset panthère officiel du projet (imageset Widget / App).
        // Fallback SF Symbol lisible si asset absent au build.
        Group {
            if UIImage(named: "PantherMark") != nil {
                Image("PantherMark")
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "flame.fill")
                    .font(.system(size: size * 0.7, weight: .bold))
                    .foregroundStyle(RG.red)
            }
        }
        .frame(width: size, height: size)
    }
}

private struct RestProgressBar: View {
    let fraction: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(RG.charcoal)
                Capsule()
                    .fill(RG.red)
                    .frame(width: max(4, geo.size.width * CGFloat(min(1, max(0, fraction)))))
            }
        }
        .frame(height: 4)
        .accessibilityLabel("Progression du repos \(Int((fraction * 100).rounded())) pour cent")
    }
}

private struct CompactRing: View {
    let fraction: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(RG.charcoal, lineWidth: 2.5)
            Circle()
                .trim(from: 0, to: CGFloat(min(1, max(0, fraction))))
                .stroke(RG.red, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 14, height: 14)
        .accessibilityHidden(true)
    }
}

@ViewBuilder
private func restClock(state: RestTimerAttributes.ContentState, font: Font) -> some View {
    if state.paused {
        Text(formatClock(state.pausedRemainingSec))
            .font(font)
    } else if let end = state.restEndsAt, end.timeIntervalSinceNow > 0 {
        // Timer SwiftUI local — pas d'update JS chaque seconde.
        Text(timerInterval: Date()...end, countsDown: true)
            .font(font)
            .multilineTextAlignment(.trailing)
    } else {
        Text("00:00")
            .font(font)
    }
}

private func formatClock(_ totalSec: Int) -> String {
    let s = max(0, totalSec)
    return String(format: "%02d:%02d", s / 60, s % 60)
}

private func restA11y(_ state: RestTimerAttributes.ContentState) -> String {
    if !state.hasActiveRest {
        return "Pas de repos en cours"
    }
    let sec = state.remainingSec()
    let pause = state.paused ? ", en pause" : ""
    return "Repos \(formatClock(sec))\(pause)"
}

@main
struct RestTimerLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        RestTimerLiveActivityWidget()
    }
}
