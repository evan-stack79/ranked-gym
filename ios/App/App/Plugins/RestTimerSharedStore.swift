import Foundation

/// File d'actions natives (Island / Lock Screen) → app Capacitor.
/// App Group optionnel ; fallback UserDefaults standard (même process uniquement).
enum RestTimerSharedStore {
    static let appGroupId = "group.com.rankedgym.app"
    static let pendingKey = "rankedgym.liveActivity.pendingActions"
    static let deepLinkKey = "rankedgym.liveActivity.pendingDeepLink"
    static let lastActionTokenKey = "rankedgym.liveActivity.lastActionToken"

    struct PendingAction: Codable, Equatable {
        let id: String
        let type: String
        let deltaSec: Int?
        let sessionId: String
        let createdAtMs: Double
    }

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupId) ?? .standard
    }

    static func enqueue(_ action: PendingAction) {
        // Anti double-tap : ignore token déjà consommé.
        if action.id == defaults.string(forKey: lastActionTokenKey) {
            return
        }
        var list = loadPending()
        list.append(action)
        // Cap mémoire — ne garder que les 20 dernières.
        if list.count > 20 {
            list = Array(list.suffix(20))
        }
        if let data = try? JSONEncoder().encode(list) {
            defaults.set(data, forKey: pendingKey)
        }
        defaults.set(action.id, forKey: lastActionTokenKey)
    }

    static func loadPending() -> [PendingAction] {
        guard let data = defaults.data(forKey: pendingKey) else { return [] }
        return (try? JSONDecoder().decode([PendingAction].self, from: data)) ?? []
    }

    static func clearPending(ids: [String]? = nil) {
        guard let ids, !ids.isEmpty else {
            defaults.removeObject(forKey: pendingKey)
            return
        }
        let next = loadPending().filter { !ids.contains($0.id) }
        if next.isEmpty {
            defaults.removeObject(forKey: pendingKey)
        } else if let data = try? JSONEncoder().encode(next) {
            defaults.set(data, forKey: pendingKey)
        }
    }

    static func setPendingDeepLink(_ url: String) {
        defaults.set(url, forKey: deepLinkKey)
    }

    static func consumePendingDeepLink() -> String? {
        let value = defaults.string(forKey: deepLinkKey)
        defaults.removeObject(forKey: deepLinkKey)
        return value
    }
}
