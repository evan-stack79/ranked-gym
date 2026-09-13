import AVFoundation
import Capacitor
import CoreMedia
import CoreVideo
import UIKit

/**
 * Prototype BPM caméra (PPG) — iOS AVFoundation + torch.
 * Analyse 100 % native : aucun frame transmis au JavaScript.
 * Aucune persistance. Stop immédiat en background / destroy.
 */
@objc(CameraHeartRatePlugin)
public class CameraHeartRatePlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureVideoDataOutputSampleBufferDelegate {
    public let identifier = "CameraHeartRatePlugin"
    public let jsName = "CameraHeartRate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMeasurement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMeasurement", returnType: CAPPluginReturnPromise),
    ]

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.rankedgym.cameraHeartRate.session")
    private let sampleQueue = DispatchQueue(label: "com.rankedgym.cameraHeartRate.sample")

    private var videoOutput: AVCaptureVideoDataOutput?
    private var device: AVCaptureDevice?
    private var measuring = false
    private var measureStartedAt: CFTimeInterval = 0
    private var goodSignalStartedAt: CFTimeInterval = 0
    private var lastSampleAt: CFTimeInterval = 0
    private var peakTimestamps: [CFTimeInterval] = []
    private var lastIntensity: Double = 0
    private var rising = false
    private var signalQuality: Double = 0
    private var fingerDetected = false
    private var bpmPreview: Int?
    private var watchdogTimer: DispatchSourceTimer?
    private var backgroundObserver: NSObjectProtocol?

    private let maxDuration: CFTimeInterval = 25
    private let minGoodSignal: CFTimeInterval = 12
    private let sampleInterval: CFTimeInterval = 0.04
    private let minPeaks = 8
    private let maxIntervalCv = 0.18
    private let minBpm = 40
    private let maxBpm = 200

    public override func load() {
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.cancelInternal(reason: "cancelled", message: "Mesure interrompue (arrière-plan).")
        }
    }

    deinit {
        if let backgroundObserver {
            NotificationCenter.default.removeObserver(backgroundObserver)
        }
        teardownCamera()
        clearWatchdog()
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera],
            mediaType: .video,
            position: .back
        )
        let back = discovery.devices.first
        let hasTorch = back?.hasTorch == true
        var payload: [String: Any] = [
            "platform": "ios",
            "hasTorch": hasTorch,
            "available": back != nil && hasTorch,
        ]
        if back == nil {
            payload["reason"] = "Aucune caméra arrière disponible."
        } else if !hasTorch {
            payload["reason"] = "Flash indisponible — requis pour la mesure PPG."
        }
        call.resolve(payload)
    }

    @objc func startMeasurement(_ call: CAPPluginCall) {
        if measuring {
            call.reject("Une mesure est déjà en cours.")
            return
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            beginMeasurement(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.beginMeasurement(call)
                    } else {
                        self?.notifyResult(
                            ok: false,
                            bpm: nil,
                            confidence: nil,
                            reason: "permission_denied",
                            message: "Autorise l’accès à la caméra pour tenter la mesure."
                        )
                        call.reject("Permission caméra refusée.")
                    }
                }
            }
        default:
            notifyResult(
                ok: false,
                bpm: nil,
                confidence: nil,
                reason: "permission_denied",
                message: "Autorise l’accès à la caméra dans Réglages."
            )
            call.reject("Permission caméra refusée.")
        }
    }

    @objc func stopMeasurement(_ call: CAPPluginCall) {
        cancelInternal(reason: "cancelled", message: "Mesure annulée.")
        call.resolve()
    }

    private func beginMeasurement(_ call: CAPPluginCall) {
        resetSignalState()
        measuring = true
        measureStartedAt = CACurrentMediaTime()

        sessionQueue.async { [weak self] in
            guard let self else { return }
            do {
                try self.configureSession()
                self.session.startRunning()
                self.setTorch(true)
                DispatchQueue.main.async {
                    self.emitProgress(
                        phase: "waiting_finger",
                        message: "Place ton doigt sur la caméra arrière (flash allumé)."
                    )
                    self.scheduleWatchdog()
                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async {
                    self.measuring = false
                    self.notifyResult(
                        ok: false,
                        bpm: nil,
                        confidence: nil,
                        reason: "camera_error",
                        message: "Impossible d’ouvrir la caméra arrière."
                    )
                    call.reject("Camera error", error.localizedDescription, error)
                }
            }
        }
    }

    private func configureSession() throws {
        session.beginConfiguration()
        session.sessionPreset = .low
        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }

        guard let captureDevice = AVCaptureDevice.default(
            .builtInWideAngleCamera,
            for: .video,
            position: .back
        ) else {
            session.commitConfiguration()
            throw NSError(
                domain: "CameraHeartRate",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No back camera"]
            )
        }
        device = captureDevice

        let input = try AVCaptureDeviceInput(device: captureDevice)
        if session.canAddInput(input) {
            session.addInput(input)
        }

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.setSampleBufferDelegate(self, queue: sampleQueue)
        if session.canAddOutput(output) {
            session.addOutput(output)
        }
        videoOutput = output
        session.commitConfiguration()
    }

    private func setTorch(_ on: Bool) {
        guard let device, device.hasTorch else {
            if on {
                DispatchQueue.main.async {
                    self.cancelInternal(
                        reason: "torch_unavailable",
                        message: "Flash indisponible sur cet appareil."
                    )
                }
            }
            return
        }
        do {
            try device.lockForConfiguration()
            if on, device.isTorchModeSupported(.on) {
                try device.setTorchModeOn(level: 1.0)
            } else {
                device.torchMode = .off
            }
            device.unlockForConfiguration()
        } catch {
            if on {
                DispatchQueue.main.async {
                    self.cancelInternal(
                        reason: "torch_unavailable",
                        message: "Impossible d’activer le flash."
                    )
                }
            }
        }
    }

    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard measuring else { return }
        let now = CACurrentMediaTime()
        if now - lastSampleAt < sampleInterval { return }
        lastSampleAt = now
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        processSample(intensity: averageRed(pixelBuffer), now: now)
    }

    private func averageRed(_ pixelBuffer: CVPixelBuffer) -> Double {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return 0 }
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let buffer = base.assumingMemoryBound(to: UInt8.self)

        let x0 = width / 4
        let x1 = (3 * width) / 4
        let y0 = height / 4
        let y1 = (3 * height) / 4
        var sum = 0.0
        var count = 0.0

        for y in stride(from: y0, to: y1, by: 4) {
            let row = y * bytesPerRow
            for x in stride(from: x0, to: x1, by: 4) {
                sum += Double(buffer[row + x * 4 + 2])
                count += 1
            }
        }
        return count == 0 ? 0 : sum / count
    }

    private func processSample(intensity: Double, now: CFTimeInterval) {
        fingerDetected = intensity > 40

        if !fingerDetected {
            goodSignalStartedAt = 0
            peakTimestamps.removeAll()
            bpmPreview = nil
            signalQuality = 0
            emitProgress(
                phase: "waiting_finger",
                message: "Place ton doigt bien à plat sur la caméra et le flash."
            )
            return
        }

        if goodSignalStartedAt == 0 {
            goodSignalStartedAt = now
        }

        detectPeak(intensity: intensity, now: now)
        updatePreviewAndQuality()

        let goodFor = now - goodSignalStartedAt
        let phase = goodFor >= 2 ? "measuring" : "waiting_finger"
        emitProgress(phase: phase, message: nil)

        if goodFor >= minGoodSignal, let bpm = estimateBpm(), signalQuality >= 0.55 {
            finishSuccess(bpm: bpm, confidence: signalQuality)
        }
    }

    private func detectPeak(intensity: Double, now: CFTimeInterval) {
        let delta = intensity - lastIntensity
        lastIntensity = intensity
        if delta > 0.8 {
            rising = true
            return
        }
        if rising && delta < -0.8 {
            rising = false
            if peakTimestamps.isEmpty || now - (peakTimestamps.last ?? 0) > 0.3 {
                peakTimestamps.append(now)
                if peakTimestamps.count > 24 {
                    peakTimestamps.removeFirst()
                }
            }
        }
    }

    private func updatePreviewAndQuality() {
        let bpm = estimateBpm()
        bpmPreview = bpm
        guard bpm != nil, peakTimestamps.count >= 4 else {
            signalQuality = fingerDetected ? 0.25 : 0
            return
        }
        let cv = intervalCv()
        let base = max(0, 1.0 - cv / maxIntervalCv)
        signalQuality = min(1.0, base * (Double(peakTimestamps.count) / 10.0))
    }

    private func estimateBpm() -> Int? {
        guard peakTimestamps.count >= minPeaks else { return nil }
        var intervals: [CFTimeInterval] = []
        for i in 1..<peakTimestamps.count {
            let dt = peakTimestamps[i] - peakTimestamps[i - 1]
            if dt >= 0.3 && dt <= 1.5 {
                intervals.append(dt)
            }
        }
        guard intervals.count >= minPeaks - 1 else { return nil }
        guard intervalCv(intervals) <= maxIntervalCv else { return nil }
        let mean = intervals.reduce(0, +) / Double(intervals.count)
        let bpm = Int((60.0 / mean).rounded())
        guard bpm >= minBpm && bpm <= maxBpm else { return nil }
        return bpm
    }

    private func intervalCv(_ intervals: [CFTimeInterval]? = nil) -> Double {
        let values: [CFTimeInterval]
        if let intervals {
            values = intervals
        } else {
            var built: [CFTimeInterval] = []
            for i in 1..<peakTimestamps.count {
                built.append(peakTimestamps[i] - peakTimestamps[i - 1])
            }
            values = built
        }
        guard values.count >= 2 else { return 1 }
        let mean = values.reduce(0, +) / Double(values.count)
        guard mean > 0 else { return 1 }
        let variance = values.reduce(0) { $0 + pow($1 - mean, 2) } / Double(values.count)
        return sqrt(variance) / mean
    }

    private func scheduleWatchdog() {
        clearWatchdog()
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + 0.5, repeating: 0.5)
        timer.setEventHandler { [weak self] in
            guard let self, self.measuring else { return }
            let elapsed = CACurrentMediaTime() - self.measureStartedAt
            guard elapsed >= self.maxDuration else { return }
            if let bpm = self.estimateBpm(), self.signalQuality >= 0.55, self.fingerDetected {
                self.finishSuccess(bpm: bpm, confidence: self.signalQuality)
            } else if !self.fingerDetected {
                self.finishFailure(
                    reason: "no_finger",
                    message: "Doigt non détecté. Recouvre la caméra arrière et le flash."
                )
            } else {
                self.finishFailure(
                    reason: "insufficient_signal",
                    message: "Signal insuffisant. Réessaie dans un endroit sombre, doigt bien stable."
                )
            }
        }
        timer.resume()
        watchdogTimer = timer
    }

    private func clearWatchdog() {
        watchdogTimer?.cancel()
        watchdogTimer = nil
    }

    private func finishSuccess(bpm: Int, confidence: Double) {
        guard measuring else { return }
        measuring = false
        teardownCamera()
        clearWatchdog()
        emitProgress(phase: "complete", message: "Mesure terminée.")
        notifyResult(
            ok: true,
            bpm: bpm,
            confidence: confidence,
            reason: nil,
            message: "Estimation expérimentale — pas un dispositif médical."
        )
    }

    private func finishFailure(reason: String, message: String) {
        guard measuring else { return }
        measuring = false
        teardownCamera()
        clearWatchdog()
        emitProgress(phase: "insufficient_signal", message: message)
        notifyResult(ok: false, bpm: nil, confidence: nil, reason: reason, message: message)
    }

    private func cancelInternal(reason: String, message: String) {
        let wasMeasuring = measuring
        measuring = false
        teardownCamera()
        clearWatchdog()
        guard wasMeasuring else { return }
        emitProgress(phase: "cancelled", message: message)
        notifyResult(ok: false, bpm: nil, confidence: nil, reason: reason, message: message)
    }

    private func teardownCamera() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.setTorch(false)
            if self.session.isRunning {
                self.session.stopRunning()
            }
            self.session.beginConfiguration()
            self.session.inputs.forEach { self.session.removeInput($0) }
            self.session.outputs.forEach { self.session.removeOutput($0) }
            self.session.commitConfiguration()
            self.videoOutput = nil
            self.device = nil
        }
    }

    private func resetSignalState() {
        peakTimestamps.removeAll()
        lastIntensity = 0
        rising = false
        signalQuality = 0
        fingerDetected = false
        bpmPreview = nil
        goodSignalStartedAt = 0
        lastSampleAt = 0
    }

    private func emitProgress(phase: String, message: String?) {
        var data: [String: Any] = [
            "phase": phase,
            "signalQuality": signalQuality,
            "fingerDetected": fingerDetected,
            "elapsedMs": measuring ? Int((CACurrentMediaTime() - measureStartedAt) * 1000) : 0,
        ]
        if let bpmPreview {
            data["bpmPreview"] = bpmPreview
        }
        if let message {
            data["message"] = message
        }
        notifyListeners("progress", data: data)
    }

    private func notifyResult(
        ok: Bool,
        bpm: Int?,
        confidence: Double?,
        reason: String?,
        message: String?
    ) {
        var data: [String: Any] = ["ok": ok]
        if let bpm { data["bpm"] = bpm }
        if let confidence { data["confidence"] = confidence }
        if let reason { data["reason"] = reason }
        if let message { data["message"] = message }
        notifyListeners("result", data: data)
    }
}
