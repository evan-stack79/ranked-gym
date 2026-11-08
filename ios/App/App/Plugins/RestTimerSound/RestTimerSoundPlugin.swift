import AVFoundation
import AudioToolbox
import Capacitor
import UIKit
import UserNotifications

/**
 * Rest timer end chime + local notification (lock screen / background).
 *
 * Audio session:
 * - Other app audio playing → .playback + [.mixWithOthers, .duckOthers]
 * - Else → .ambient (respects silent switch).
 * - Countdown 3-2-1 hold session; ALWAYS deactivate with
 *   .notifyOthersOnDeactivation on: final chime, cancel/pause/stop,
 *   mute, or app background — so ducked music returns.
 *
 * Vibration: AudioServicesPlaySystemSound once from JS at end (willPresent
 * does not vibrate — avoids double). Lock screen uses notification sound /
 * silent.caf for system vibrate when muted.
 */
@objc(RestTimerSoundPlugin)
public class RestTimerSoundPlugin: CAPPlugin, CAPBridgedPlugin, UNUserNotificationCenterDelegate {
    public let identifier = "RestTimerSoundPlugin"
    public let jsName = "RestTimerSound"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playNow", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "vibrate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseAudioSession", returnType: CAPPluginReturnPromise),
    ]

    private static let notificationId = "ranked-gym.rest-timer.end"
    private static let soundFileName = "rest_timer_chime.caf"
    private static let silentSoundFileName = "rest_timer_silent.caf"

    private var player: AVAudioPlayer?
    private var playedForScheduleToken: String?
    private var sessionHeld = false
    private var sessionActive = false
    private var deactivateWorkItem: DispatchWorkItem?
    private var backgroundObserver: NSObjectProtocol?

    public override func load() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            // Ducked music must return when leaving the app mid-countdown.
            self?.releaseHeldSession()
        }
    }

    deinit {
        if let backgroundObserver {
            NotificationCenter.default.removeObserver(backgroundObserver)
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let endAtMs = call.getDouble("endAtMs") ?? 0
        let soundEnabled = call.getBool("soundEnabled") ?? true
        let haptics = call.getBool("haptics") ?? true
        let token = call.getString("token") ?? "\(Int(endAtMs))"
        playedForScheduleToken = nil
        // New schedule → release any held countdown session (music back).
        releaseHeldSession()

        let fireDate = Date(timeIntervalSince1970: endAtMs / 1000.0)
        let delay = fireDate.timeIntervalSinceNow
        guard delay > 0.05 else {
            call.resolve(["scheduled": false])
            return
        }

        requestPermissionIfNeeded { [weak self] granted in
            guard let self else {
                call.resolve(["scheduled": false])
                return
            }
            self.cancelPending()

            guard granted else {
                call.resolve(["scheduled": false, "permission": false])
                return
            }

            let content = UNMutableNotificationContent()
            content.title = "Repos terminé"
            content.body = "C’est reparti"
            if soundEnabled {
                content.sound = UNNotificationSound(named: UNNotificationSoundName(Self.soundFileName))
            } else if haptics {
                content.sound = UNNotificationSound(named: UNNotificationSoundName(Self.silentSoundFileName))
            } else {
                content.sound = nil
            }
            content.userInfo = [
                "token": token,
                "soundEnabled": soundEnabled,
                "haptics": haptics,
            ]

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
            let request = UNNotificationRequest(
                identifier: Self.notificationId,
                content: content,
                trigger: trigger
            )
            UNUserNotificationCenter.current().add(request) { error in
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["scheduled": true, "permission": true])
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let cancelPendingFlag = call.getBool("cancelPending") ?? true
        let releaseSession = call.getBool("releaseSession") ?? true
        if cancelPendingFlag {
            cancelPending()
        }
        if releaseSession {
            releaseHeldSession()
        }
        call.resolve()
    }

    /// Release ducked session without cancelling the lock-screen notification.
    @objc func releaseAudioSession(_ call: CAPPluginCall) {
        releaseHeldSession()
        call.resolve()
    }

    @objc func preview(_ call: CAPPluginCall) {
        playChime(force: true, volume: 1.0, maxDurationSec: nil, holdSession: false)
        call.resolve()
    }

    @objc func playNow(_ call: CAPPluginCall) {
        let token = call.getString("token")
        let cancelPendingFlag = call.getBool("cancelPending") ?? true
        let volume = min(1.0, max(0.0, CGFloat(call.getFloat("volume") ?? 1.0)))
        let maxDuration = call.getDouble("maxDurationSec")
        let holdSession = call.getBool("holdSession") ?? false
        if let token, playedForScheduleToken == token {
            call.resolve(["played": false, "reason": "already"])
            return
        }
        if cancelPendingFlag {
            removeDelivered()
            cancelPending()
        }
        playChime(
            force: false,
            volume: Float(volume),
            maxDurationSec: maxDuration,
            holdSession: holdSession
        )
        if cancelPendingFlag, let token {
            playedForScheduleToken = token
        }
        call.resolve(["played": true])
    }

    @objc func vibrate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
        call.resolve()
    }

    // MARK: - UNUserNotificationCenterDelegate

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        guard notification.request.identifier == Self.notificationId else {
            completionHandler([])
            return
        }
        let token = notification.request.content.userInfo["token"] as? String
        let soundEnabled = (notification.request.content.userInfo["soundEnabled"] as? Bool) ?? true
        if let token, playedForScheduleToken == token {
            completionHandler([])
            return
        }
        if soundEnabled {
            playChime(force: false, volume: 1.0, maxDurationSec: nil, holdSession: false)
        }
        // No vibrate here — JS fireHapticAtEnd is the single vibration source.
        // Lock-screen (background) uses notification sound / silent.caf system vibrate.
        if let token {
            playedForScheduleToken = token
        }
        removeDelivered()
        completionHandler([])
    }

    // MARK: - Private

    private func requestPermissionIfNeeded(completion: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                DispatchQueue.main.async { completion(true) }
            case .denied:
                DispatchQueue.main.async { completion(false) }
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    DispatchQueue.main.async { completion(granted) }
                }
            @unknown default:
                DispatchQueue.main.async { completion(false) }
            }
        }
    }

    private func cancelPending() {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [Self.notificationId])
    }

    private func removeDelivered() {
        UNUserNotificationCenter.current()
            .removeDeliveredNotifications(withIdentifiers: [Self.notificationId])
    }

    private func otherAudioPlaying() -> Bool {
        let session = AVAudioSession.sharedInstance()
        return session.isOtherAudioPlaying || session.secondaryAudioShouldBeSilencedHint
    }

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        if otherAudioPlaying() {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
        } else {
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        }
        try session.setActive(true)
        sessionActive = true
    }

    private func deactivateSession() {
        sessionHeld = false
        guard sessionActive else { return }
        sessionActive = false
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func releaseHeldSession() {
        deactivateWorkItem?.cancel()
        deactivateWorkItem = nil
        player?.stop()
        player = nil
        // Always notify others — music must return even mid-countdown.
        deactivateSession()
    }

    private func playChime(force: Bool, volume: Float, maxDurationSec: Double?, holdSession: Bool) {
        DispatchQueue.main.async {
            self.deactivateWorkItem?.cancel()
            self.deactivateWorkItem = nil
            do {
                try self.configureSession()
                if holdSession {
                    self.sessionHeld = true
                }
                guard let url = Bundle.main.url(forResource: "rest_timer_chime", withExtension: "caf") else {
                    if !holdSession {
                        self.deactivateSession()
                    }
                    return
                }
                let player = try AVAudioPlayer(contentsOf: url)
                player.volume = min(1.0, max(0.0, volume))
                player.prepareToPlay()
                self.player = player
                player.play()
                let natural = max(0.2, player.duration + 0.05)
                let delay: Double
                if let maxDurationSec, maxDurationSec > 0 {
                    delay = min(natural, maxDurationSec)
                } else {
                    delay = natural
                }
                let work = DispatchWorkItem { [weak self] in
                    guard let self else { return }
                    if let maxDurationSec, maxDurationSec > 0, self.player?.isPlaying == true {
                        self.player?.stop()
                    }
                    self.player = nil
                    if holdSession {
                        return
                    }
                    self.deactivateSession()
                }
                self.deactivateWorkItem = work
                DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
            } catch {
                if !holdSession {
                    self.deactivateSession()
                }
                if force {
                    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
                }
            }
        }
    }
}
