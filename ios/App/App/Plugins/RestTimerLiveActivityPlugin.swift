import ActivityKit
import Capacitor
import Foundation

@objc(RestTimerLiveActivityPlugin)
public class RestTimerLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestTimerLiveActivityPlugin"
    public let jsName = "RestTimerLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanupStale", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingNativeActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingDeepLink", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([
                "available": false,
                "authorized": false,
                "platform": "ios",
                "reason": "Live Activities require iOS 16.2+",
            ])
            return
        }
        Task {
            let status = await RestTimerActivityController.shared.isAuthorized()
            call.resolve([
                "available": status.available,
                "authorized": status.authorized,
                "platform": "ios",
                "supportsDynamicIsland": true,
                "supportsInteractive": ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 17,
            ])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["started": false, "reason": "unsupported"])
            return
        }
        guard let sessionId = call.getString("sessionId"), !sessionId.isEmpty else {
            call.reject("sessionId required")
            return
        }
        guard let state = Self.parseState(call) else {
            call.reject("invalid content state")
            return
        }

        Task {
            do {
                let auth = await RestTimerActivityController.shared.isAuthorized()
                guard auth.authorized else {
                    call.resolve([
                        "started": false,
                        "reason": "not_authorized",
                    ])
                    return
                }
                let id = try await RestTimerActivityController.shared.start(
                    sessionId: sessionId,
                    state: state
                )
                call.resolve(["started": true, "activityId": id])
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
        guard let sessionId = call.getString("sessionId"), !sessionId.isEmpty else {
            call.resolve()
            return
        }
        guard let state = Self.parseState(call) else {
            call.resolve()
            return
        }
        Task {
            await RestTimerActivityController.shared.update(sessionId: sessionId, state: state)
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId")
        let immediate = call.getBool("immediate") ?? true
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            await RestTimerActivityController.shared.end(sessionId: sessionId, immediate: immediate)
            call.resolve()
        }
    }

    @objc func cleanupStale(_ call: CAPPluginCall) {
        let activeSessionId = call.getString("activeSessionId")
        guard #available(iOS 16.2, *) else {
            call.resolve(["cleaned": 0])
            return
        }
        Task {
            await RestTimerActivityController.shared.cleanupStale(activeSessionId: activeSessionId)
            call.resolve(["cleaned": true])
        }
    }

    @objc func pendingNativeActions(_ call: CAPPluginCall) {
        let actions = RestTimerSharedStore.loadPending().map { action -> [String: Any] in
            var row: [String: Any] = [
                "id": action.id,
                "type": action.type,
                "sessionId": action.sessionId,
                "createdAtMs": action.createdAtMs,
            ]
            if let delta = action.deltaSec {
                row["deltaSec"] = delta
            }
            return row
        }
        call.resolve(["actions": actions])
    }

    @objc func clearPendingActions(_ call: CAPPluginCall) {
        if let ids = call.getArray("ids", String.self) {
            RestTimerSharedStore.clearPending(ids: ids)
        } else {
            RestTimerSharedStore.clearPending(ids: nil)
        }
        call.resolve()
    }

    @objc func consumePendingDeepLink(_ call: CAPPluginCall) {
        let url = RestTimerSharedStore.consumePendingDeepLink()
        call.resolve(["url": url as Any])
    }

    /// Parse l'état depuis le call Capacitor (timestamps epoch ms).
    private static func parseState(_ call: CAPPluginCall) -> RestTimerAttributes.ContentState? {
        let exerciseName = (call.getString("exerciseName") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !exerciseName.isEmpty else { return nil }

        let setCurrent = max(1, call.getInt("setCurrent") ?? 1)
        let setTotal = max(0, call.getInt("setTotal") ?? 0)
        let restTotalSec = max(0, call.getInt("restTotalSec") ?? 0)
        let paused = call.getBool("paused") ?? false
        let pausedRemainingSec = max(0, call.getInt("pausedRemainingSec") ?? 0)
        let sessionProgress = call.getDouble("sessionProgress") ?? 0

        var restEndsAt: Date? = nil
        if let ms = call.getDouble("restEndsAtMs"), ms > 0 {
            restEndsAt = Date(timeIntervalSince1970: ms / 1000.0)
        }

        return RestTimerAttributes.ContentState(
            exerciseName: exerciseName,
            setCurrent: setCurrent,
            setTotal: setTotal,
            restEndsAt: restEndsAt,
            restTotalSec: restTotalSec,
            paused: paused,
            pausedRemainingSec: pausedRemainingSec,
            sessionProgress: min(1, max(0, sessionProgress))
        )
    }
}

extension RestTimerLiveActivityPlugin {
    /// Enregistre un deep link entrant (URL scheme) pour consommation JS.
    @objc public static func enqueueDeepLink(_ url: URL) {
        RestTimerSharedStore.setPendingDeepLink(url.absoluteString)
        // Aussi parser actions live-activity dans la query.
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let host = (comps.host ?? "").lowercased()
        let path = comps.path.lowercased()
        let items = comps.queryItems ?? []
        func q(_ name: String) -> String? {
            items.first(where: { $0.name == name })?.value
        }

        if host == "session" || path.contains("session") {
            // rankedgym://session/active — ouverture séance, pas d'action timer.
            return
        }

        if host == "live-activity" || path.contains("live-activity") {
            let action = (q("action") ?? "").lowercased()
            let sessionId = q("sessionId") ?? ""
            let token = q("token") ?? UUID().uuidString
            switch action {
            case "adjust":
                let delta = Int(q("delta") ?? "0") ?? 0
                RestTimerSharedStore.enqueue(
                    .init(
                        id: token,
                        type: "adjust",
                        deltaSec: delta,
                        sessionId: sessionId,
                        createdAtMs: Date().timeIntervalSince1970 * 1000
                    )
                )
            case "pause":
                RestTimerSharedStore.enqueue(
                    .init(
                        id: token,
                        type: "pause",
                        deltaSec: nil,
                        sessionId: sessionId,
                        createdAtMs: Date().timeIntervalSince1970 * 1000
                    )
                )
            case "resume":
                RestTimerSharedStore.enqueue(
                    .init(
                        id: token,
                        type: "resume",
                        deltaSec: nil,
                        sessionId: sessionId,
                        createdAtMs: Date().timeIntervalSince1970 * 1000
                    )
                )
            default:
                break
            }
        }
    }
}
