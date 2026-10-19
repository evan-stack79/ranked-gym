import ActivityKit
import Capacitor
import Foundation

@objc(RestTimerLiveActivityPlugin)
public class RestTimerLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestTimerLiveActivityPlugin"
    public let jsName = "RestTimerLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    ]

    /// Opaque box so `Activity` (iOS 16.1+) is never a stored property type on a
    /// plugin compiled against the App deployment target (iOS 15.0).
    private var currentActivityBox: Any?

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

        let remaining = max(0, call.getInt("remainingSec") ?? 0)
        let total = max(1, call.getInt("totalSec") ?? remaining)
        let subtitle = call.getString("subtitle") ?? "Repos en cours"

        Task {
            await self.endCurrentActivity(dismissalPolicy: .immediate)

            let attributes = RestTimerAttributes(title: "Temps de repos")
            let state = RestTimerAttributes.ContentState(
                remainingSec: remaining,
                totalSec: total,
                subtitle: subtitle
            )

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil),
                    pushType: nil
                )
                self.currentActivityBox = activity
                call.resolve(["activityId": activity.id])
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

        let remaining = max(0, call.getInt("remainingSec") ?? 0)
        let subtitle = call.getString("subtitle")

        Task {
            guard let activity = self.currentActivityBox as? Activity<RestTimerAttributes> else {
                call.resolve()
                return
            }

            let nextState = RestTimerAttributes.ContentState(
                remainingSec: remaining,
                totalSec: activity.content.state.totalSec,
                subtitle: subtitle ?? activity.content.state.subtitle
            )

            await activity.update(.init(state: nextState, staleDate: nil))
            call.resolve()
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
        if let activity = currentActivityBox as? Activity<RestTimerAttributes> {
            let finalState = activity.content.state
            await activity.end(
                .init(state: finalState, staleDate: nil),
                dismissalPolicy: dismissalPolicy
            )
            currentActivityBox = nil
            return
        }

        for activity in Activity<RestTimerAttributes>.activities {
            await activity.end(nil, dismissalPolicy: dismissalPolicy)
        }
    }
}
