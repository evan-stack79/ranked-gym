import ActivityKit
import Capacitor
import Foundation

/**
 * Unified Live Activity plugin (repos / séance / pas / record / rang).
 * JS name: LiveActivity. One Activity at a time for session+rest.
 *
 * Rest: JS sends a fixed `endDateMs` (+ pause snapshot). Widget renders
 * `Text(timerInterval:)` — no per-second updates from the app.
 */
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "alert", returnType: CAPPluginReturnPromise),
    ]

    /// Opaque box so `Activity` is never a stored property type on iOS 15 deploy target.
    private var currentActivityBox: Any?

    public override func load() {
        LiveActivityActionBridge.shared.onAction = { [weak self] action in
            self?.notifyListeners("liveAction", data: ["action": action])
        }
        LiveActivityActionBridge.shared.install()
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        let state = Self.contentState(from: call)
        let token = call.getString("activityToken") ?? "ranked-gym.live"
        let reuse = call.getBool("reuseIfPresent") ?? false
        let stale = Self.staleDate(for: state)

        Task {
            if reuse, let activity = self.currentActivityBox as? Activity<RankedGymLiveAttributes> {
                await activity.update(.init(state: state, staleDate: stale))
                call.resolve(["activityId": activity.id, "reused": true])
                return
            }

            await self.endCurrentActivity(dismissalPolicy: .immediate)

            let attributes = RankedGymLiveAttributes(activityToken: token)
            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: stale),
                    pushType: nil
                )
                self.currentActivityBox = activity
                call.resolve(["activityId": activity.id, "reused": false])
            } catch {
                call.reject("Unable to start Live Activity", nil, error)
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }

        Task {
            guard let activity = self.currentActivityBox as? Activity<RankedGymLiveAttributes> else {
                call.resolve(["updated": false])
                return
            }
            let merged = Self.merge(existing: activity.content.state, call: call)
            await activity.update(.init(state: merged, staleDate: Self.staleDate(for: merged)))
            call.resolve(["updated": true])
        }
    }

    /// Short alert on the current activity (record / rank).
    @objc func alert(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }

        let kind = call.getString("kind") ?? "record"
        let title = call.getString("alertTitle") ?? ""
        let body = call.getString("alertBody") ?? ""

        Task {
            guard let activity = self.currentActivityBox as? Activity<RankedGymLiveAttributes> else {
                call.resolve(["alerted": false])
                return
            }
            var next = activity.content.state
            next.kind = kind
            next.alertTitle = title
            next.alertBody = body

            let alert = AlertConfiguration(
                title: LocalizedStringResource(stringLiteral: title),
                body: LocalizedStringResource(stringLiteral: body),
                sound: .default
            )
            await activity.update(
                ActivityContent(state: next, staleDate: Self.staleDate(for: next)),
                alertConfiguration: alert
            )
            call.resolve(["alerted": true])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        let immediate = call.getBool("immediate") ?? true
        Task {
            if #available(iOS 16.2, *) {
                await self.endCurrentActivity(
                    dismissalPolicy: immediate ? .immediate : .default
                )
            }
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private func endCurrentActivity(dismissalPolicy: ActivityUIDismissalPolicy) async {
        if let activity = currentActivityBox as? Activity<RankedGymLiveAttributes> {
            let finalState = activity.content.state
            await activity.end(
                .init(state: finalState, staleDate: Self.staleDate(for: finalState)),
                dismissalPolicy: dismissalPolicy
            )
            currentActivityBox = nil
            return
        }
        for activity in Activity<RankedGymLiveAttributes>.activities {
            await activity.end(nil, dismissalPolicy: dismissalPolicy)
        }
        currentActivityBox = nil
    }

    /// `staleDate` = rest `endDate` so the system can retire the activity at zero.
    @available(iOS 16.1, *)
    private static func staleDate(for state: RankedGymLiveAttributes.ContentState) -> Date? {
        guard state.kind == "rest", state.endDateMs > 0 else { return nil }
        return Date(timeIntervalSince1970: state.endDateMs / 1000.0)
    }

    @available(iOS 16.1, *)
    private static func contentState(from call: CAPPluginCall) -> RankedGymLiveAttributes.ContentState {
        RankedGymLiveAttributes.ContentState(
            kind: call.getString("kind") ?? "rest",
            remainingSec: max(0, call.getInt("remainingSec") ?? 0),
            totalSec: max(1, call.getInt("totalSec") ?? 1),
            paused: call.getBool("paused") ?? false,
            startDateMs: max(0, call.getDouble("startDateMs") ?? 0),
            endDateMs: max(0, call.getDouble("endDateMs") ?? 0),
            exerciseName: call.getString("exerciseName") ?? "",
            setIndex: call.getInt("setIndex") ?? 1,
            setTotal: call.getInt("setTotal") ?? 1,
            weightKg: call.getDouble("weightKg") ?? 0,
            reps: call.getInt("reps") ?? 0,
            startedAtMs: call.getDouble("startedAtMs") ?? 0,
            steps: call.getInt("steps") ?? 0,
            stepsGoal: call.getInt("stepsGoal") ?? 0,
            alertTitle: call.getString("alertTitle") ?? "",
            alertBody: call.getString("alertBody") ?? "",
            subtitle: call.getString("subtitle") ?? ""
        )
    }

    @available(iOS 16.1, *)
    private static func merge(
        existing: RankedGymLiveAttributes.ContentState,
        call: CAPPluginCall
    ) -> RankedGymLiveAttributes.ContentState {
        var next = existing
        if let v = call.getString("kind") { next.kind = v }
        if let v = call.getInt("remainingSec") { next.remainingSec = max(0, v) }
        if let v = call.getInt("totalSec") { next.totalSec = max(1, v) }
        if let paused = call.getValue("paused") as? Bool { next.paused = paused }
        if call.getValue("startDateMs") != nil {
            next.startDateMs = max(0, call.getDouble("startDateMs") ?? 0)
        }
        if call.getValue("endDateMs") != nil {
            next.endDateMs = max(0, call.getDouble("endDateMs") ?? 0)
        }
        if let v = call.getString("exerciseName") { next.exerciseName = v }
        if let v = call.getInt("setIndex") { next.setIndex = v }
        if let v = call.getInt("setTotal") { next.setTotal = v }
        if let v = call.getDouble("weightKg") { next.weightKg = v }
        if let v = call.getInt("reps") { next.reps = v }
        if let v = call.getDouble("startedAtMs") { next.startedAtMs = v }
        if let v = call.getInt("steps") { next.steps = v }
        if let v = call.getInt("stepsGoal") { next.stepsGoal = v }
        if let v = call.getString("alertTitle") { next.alertTitle = v }
        if let v = call.getString("alertBody") { next.alertBody = v }
        if let v = call.getString("subtitle") { next.subtitle = v }
        return next
    }
}

/// Routes Darwin notifications (App Intents in widget) → Capacitor listeners.
final class LiveActivityActionBridge {
    static let shared = LiveActivityActionBridge()
    var onAction: ((String) -> Void)?
    private var installed = false

    func install() {
        guard !installed else { return }
        installed = true
        observe(LiveActivityActionNotify.pause, action: "pause")
        observe(LiveActivityActionNotify.stop, action: "stop")
        observe(LiveActivityActionNotify.validate, action: "validate")
        observe(LiveActivityActionNotify.add15, action: "add15")
    }

    private func observe(_ name: CFString, action: String) {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passRetained(ActionToken(action: action, bridge: self)).toOpaque()
        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer else { return }
                let token = Unmanaged<ActionToken>.fromOpaque(observer).takeUnretainedValue()
                DispatchQueue.main.async {
                    token.bridge?.onAction?(token.action)
                }
            },
            name,
            nil,
            .deliverImmediately
        )
    }

    private final class ActionToken {
        let action: String
        weak var bridge: LiveActivityActionBridge?
        init(action: String, bridge: LiveActivityActionBridge) {
            self.action = action
            self.bridge = bridge
        }
    }
}
