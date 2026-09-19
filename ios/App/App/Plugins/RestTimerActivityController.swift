import ActivityKit
import Foundation

/// Contrôleur unique ActivityKit — appelé depuis le plugin Capacitor.
@available(iOS 16.2, *)
actor RestTimerActivityController {
    static let shared = RestTimerActivityController()

    func isAuthorized() -> (available: Bool, authorized: Bool) {
        let info = ActivityAuthorizationInfo()
        return (info.areActivitiesEnabled, info.areActivitiesEnabled)
    }

    func start(sessionId: String, state: RestTimerAttributes.ContentState) async throws -> String {
        await endAll(matching: nil, dismissal: .immediate)
        let attributes = RestTimerAttributes(sessionId: sessionId)
        let activity = try Activity.request(
            attributes: attributes,
            content: .init(state: state, staleDate: state.restEndsAt),
            pushType: nil
        )
        return activity.id
    }

    func update(sessionId: String, state: RestTimerAttributes.ContentState) async {
        for activity in Activity<RestTimerAttributes>.activities where activity.attributes.sessionId == sessionId {
            await activity.update(.init(state: state, staleDate: state.restEndsAt))
            return
        }
    }

    func end(sessionId: String?, immediate: Bool) async {
        let policy: ActivityUIDismissalPolicy = immediate ? .immediate : .default
        await endAll(matching: sessionId, dismissal: policy)
    }

    func cleanupStale(activeSessionId: String?) async {
        for activity in Activity<RestTimerAttributes>.activities {
            if let activeSessionId, activity.attributes.sessionId == activeSessionId {
                continue
            }
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private func endAll(matching sessionId: String?, dismissal: ActivityUIDismissalPolicy) async {
        for activity in Activity<RestTimerAttributes>.activities {
            if let sessionId, activity.attributes.sessionId != sessionId { continue }
            await activity.end(nil, dismissalPolicy: dismissal)
        }
    }
}
