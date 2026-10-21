import AVFoundation
import Capacitor
import UIKit
import UserNotifications

/**
 * Rest timer end chime + local notification (lock screen / background).
 * Route-aware AVAudioSession: headphones → .playback + duck; speaker → .ambient.
 * Does not inspect the hardware mute switch.
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
    ]

    private static let notificationId = "ranked-gym.rest-timer.end"
    private static let soundFileName = "rest_timer_chime.caf"

    private var player: AVAudioPlayer?
    private var playedForScheduleToken: String?

    public override func load() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let endAtMs = call.getDouble("endAtMs") ?? 0
        let soundEnabled = call.getBool("soundEnabled") ?? true
        let token = call.getString("token") ?? "\(Int(endAtMs))"
        playedForScheduleToken = nil

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
                // Permission denied — foreground path (JS playNow) still works.
                call.resolve(["scheduled": false, "permission": false])
                return
            }

            let content = UNMutableNotificationContent()
            content.title = "Repos terminé"
            content.body = "C’est reparti"
            content.sound = soundEnabled
                ? UNNotificationSound(named: UNNotificationSoundName(Self.soundFileName))
                : nil
            content.userInfo = ["token": token, "soundEnabled": soundEnabled]

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
        cancelPending()
        call.resolve()
    }

    @objc func preview(_ call: CAPPluginCall) {
        playChime(force: true)
        call.resolve()
    }

    @objc func playNow(_ call: CAPPluginCall) {
        let token = call.getString("token")
        let cancelPendingFlag = call.getBool("cancelPending") ?? true
        if let token, playedForScheduleToken == token {
            call.resolve(["played": false, "reason": "already"])
            return
        }
        if cancelPendingFlag {
            removeDelivered()
            cancelPending()
        }
        playChime(force: false)
        // Only mark the end-of-rest token (not countdown beeps).
        if cancelPendingFlag, let token {
            playedForScheduleToken = token
        }
        call.resolve(["played": true])
    }

    @objc func vibrate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let gen = UINotificationFeedbackGenerator()
            gen.prepare()
            gen.notificationOccurred(.success)
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
        // Foreground at fire time: suppress banner, play via AVAudioPlayer once.
        let token = notification.request.content.userInfo["token"] as? String
        let soundEnabled = (notification.request.content.userInfo["soundEnabled"] as? Bool) ?? true
        if let token, playedForScheduleToken == token {
            completionHandler([])
            return
        }
        if soundEnabled {
            playChime(force: false)
        }
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
                self.permissionAsked = true
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

    private func headphonesConnected() -> Bool {
        let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
        let headphoneTypes: Set<AVAudioSession.Port> = [
            .headphones,
            .bluetoothA2DP,
            .bluetoothHFP,
            .bluetoothLE,
        ]
        return outputs.contains { headphoneTypes.contains($0.portType) }
    }

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        if headphonesConnected() {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
        } else {
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        }
        try session.setActive(true)
    }

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func playChime(force: Bool) {
        DispatchQueue.main.async {
            do {
                try self.configureSession()
                guard let url = Bundle.main.url(forResource: "rest_timer_chime", withExtension: "caf") else {
                    self.deactivateSession()
                    return
                }
                let player = try AVAudioPlayer(contentsOf: url)
                player.volume = 1.0
                player.prepareToPlay()
                self.player = player
                player.play()
                let delay = max(0.2, player.duration + 0.05)
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    self.player = nil
                    self.deactivateSession()
                }
            } catch {
                self.deactivateSession()
                if force {
                    // Preview fallback: light haptic so the control still responds.
                    let gen = UINotificationFeedbackGenerator()
                    gen.notificationOccurred(.success)
                }
            }
        }
    }
}
