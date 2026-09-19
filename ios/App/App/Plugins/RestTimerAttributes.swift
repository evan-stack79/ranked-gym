import ActivityKit
import Foundation

/// Payload ActivityKit minimal — une seule séance active Ranked Gym.
/// Timer repos = `restEndsAt` (Date) pour rendu SwiftUI local, pas d'update/seconde.
struct RestTimerAttributes: ActivityAttributes {
    /// Identité de séance stable (`routineId:startedAt`). Jamais de PII.
    public struct ContentState: Codable, Hashable {
        /// Nom d'exercice réel (fourni par la séance JS).
        var exerciseName: String
        /// Série courante (1-based).
        var setCurrent: Int
        /// Total de séries pour l'exercice courant.
        var setTotal: Int
        /// Fin absolue du repos ; `nil` = pas de repos actif.
        var restEndsAt: Date?
        /// Durée totale du repos (pour barre de progression).
        var restTotalSec: Int
        /// Repos en pause (timer figé via `pausedRemainingSec`).
        var paused: Bool
        /// Secondes restantes figées si `paused`.
        var pausedRemainingSec: Int
        /// Progression séance 0…1 (exercices), info non-couleur.
        var sessionProgress: Double
    }

    /// sessionId = `routineId:startedAt` — source de vérité unique.
    var sessionId: String
}

extension RestTimerAttributes.ContentState {
    var setLine: String {
        guard setTotal > 0 else { return "Série \(max(1, setCurrent))" }
        return "Série \(max(1, setCurrent))/\(setTotal)"
    }

    var setLineVerbose: String {
        guard setTotal > 0 else { return "Série \(max(1, setCurrent))" }
        return "Série \(max(1, setCurrent)) sur \(setTotal)"
    }

    func remainingSec(now: Date = Date()) -> Int {
        if paused { return max(0, pausedRemainingSec) }
        guard let end = restEndsAt else { return 0 }
        return max(0, Int(ceil(end.timeIntervalSince(now))))
    }

    var hasActiveRest: Bool {
        if paused { return pausedRemainingSec > 0 }
        guard let end = restEndsAt else { return false }
        return end.timeIntervalSinceNow > 0
    }

    func progressFraction(now: Date = Date()) -> Double {
        guard restTotalSec > 0 else { return 0 }
        let left = Double(remainingSec(now: now))
        return min(1, max(0, 1 - left / Double(restTotalSec)))
    }
}
