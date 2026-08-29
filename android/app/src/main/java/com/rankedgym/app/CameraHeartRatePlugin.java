package com.rankedgym.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.Size;

import androidx.annotation.NonNull;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Prototype BPM caméra (PPG) — Android CameraX + flash.
 * Analyse 100 % native : aucun frame transmis au JavaScript.
 * Aucune persistance locale / cloud. Stop immédiat en pause / destroy.
 */
@CapacitorPlugin(
    name = "CameraHeartRate",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
    }
)
public class CameraHeartRatePlugin extends Plugin {
    private static final String TAG = "CameraHeartRate";
    private static final long MAX_DURATION_MS = 25_000L;
    private static final long MIN_GOOD_SIGNAL_MS = 12_000L;
    private static final long SAMPLE_INTERVAL_MS = 40L;
    private static final int MIN_PEAKS = 8;
    private static final double MAX_INTERVAL_CV = 0.18;
    private static final int MIN_BPM = 40;
    private static final int MAX_BPM = 200;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AtomicBoolean measuring = new AtomicBoolean(false);

    private ExecutorService analysisExecutor;
    private ProcessCameraProvider cameraProvider;
    private Camera camera;

    private long measureStartedAt;
    private long goodSignalStartedAt;
    private long lastSampleAt;
    private final List<Long> peakTimestamps = new ArrayList<>();
    private double lastIntensity = 0;
    private boolean rising = false;
    private double signalQuality = 0;
    private boolean fingerDetected = false;
    private Integer bpmPreview = null;
    private Runnable watchdog;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        boolean hasCamera = pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY);
        boolean hasFlash = pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH);
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("hasTorch", hasFlash);
        result.put("available", hasCamera && hasFlash);
        if (!hasCamera) {
            result.put("reason", "Aucune caméra disponible.");
        } else if (!hasFlash) {
            result.put("reason", "Flash indisponible — requis pour la mesure PPG.");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void startMeasurement(PluginCall call) {
        if (measuring.get()) {
            call.reject("Une mesure est déjà en cours.");
            return;
        }
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "onCameraPermission");
            return;
        }
        beginMeasurement(call);
    }

    @PermissionCallback
    private void onCameraPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            beginMeasurement(call);
            return;
        }
        notifyResult(false, null, null, "permission_denied",
            "Autorise l’accès à la caméra pour tenter la mesure.");
        call.reject("Permission caméra refusée.");
    }

    @PluginMethod
    public void stopMeasurement(PluginCall call) {
        cancelInternal("cancelled", "Mesure annulée.");
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (measuring.get()) {
            cancelInternal("cancelled", "Mesure interrompue (arrière-plan).");
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        teardownCamera();
        clearWatchdog();
    }

    private void beginMeasurement(PluginCall call) {
        resetSignalState();
        measuring.set(true);
        measureStartedAt = System.currentTimeMillis();
        analysisExecutor = Executors.newSingleThreadExecutor();

        ListenableFuture<ProcessCameraProvider> future =
            ProcessCameraProvider.getInstance(getContext());
        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                bindCamera();
                emitProgress("waiting_finger",
                    "Place ton doigt sur la caméra arrière (flash allumé).");
                scheduleWatchdog();
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Camera bind failed", e);
                measuring.set(false);
                notifyResult(false, null, null, "camera_error",
                    "Impossible d’ouvrir la caméra arrière.");
                call.reject("Camera error", e);
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    private void bindCamera() {
        if (cameraProvider == null || getActivity() == null) {
            throw new IllegalStateException("Camera provider or activity missing");
        }
        cameraProvider.unbindAll();

        ResolutionSelector resolutionSelector = new ResolutionSelector.Builder()
            .setResolutionStrategy(new ResolutionStrategy(
                new Size(320, 240),
                ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
            ))
            .build();

        ImageAnalysis analysis = new ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setResolutionSelector(resolutionSelector)
            .build();
        analysis.setAnalyzer(analysisExecutor, this::analyzeFrame);

        CameraSelector selector = new CameraSelector.Builder()
            .requireLensFacing(CameraSelector.LENS_FACING_BACK)
            .build();

        camera = cameraProvider.bindToLifecycle(
            (LifecycleOwner) getActivity(),
            selector,
            analysis
        );

        if (camera.getCameraInfo().hasFlashUnit()) {
            camera.getCameraControl().enableTorch(true);
        } else {
            cancelInternal("torch_unavailable", "Flash indisponible sur cet appareil.");
        }
    }

    private void analyzeFrame(@NonNull ImageProxy image) {
        try {
            if (!measuring.get()) {
                return;
            }
            long now = System.currentTimeMillis();
            if (now - lastSampleAt < SAMPLE_INTERVAL_MS) {
                return;
            }
            lastSampleAt = now;
            processSample(averageLuma(image), now);
        } finally {
            image.close();
        }
    }

    private double averageLuma(ImageProxy image) {
        ImageProxy.PlaneProxy yPlane = image.getPlanes()[0];
        ByteBuffer buffer = yPlane.getBuffer().duplicate();
        int rowStride = yPlane.getRowStride();
        int pixelStride = yPlane.getPixelStride();
        int width = image.getWidth();
        int height = image.getHeight();
        long sum = 0;
        int count = 0;
        int x0 = width / 4;
        int x1 = (3 * width) / 4;
        int y0 = height / 4;
        int y1 = (3 * height) / 4;
        for (int y = y0; y < y1; y += 4) {
            int rowStart = y * rowStride;
            for (int x = x0; x < x1; x += 4) {
                int index = rowStart + x * pixelStride;
                if (index >= 0 && index < buffer.capacity()) {
                    sum += (buffer.get(index) & 0xff);
                    count++;
                }
            }
        }
        return count == 0 ? 0 : (double) sum / (double) count;
    }

    private void processSample(double intensity, long now) {
        fingerDetected = intensity > 40.0;

        if (!fingerDetected) {
            goodSignalStartedAt = 0;
            peakTimestamps.clear();
            bpmPreview = null;
            signalQuality = 0;
            emitProgress("waiting_finger",
                "Place ton doigt bien à plat sur la caméra et le flash.");
            return;
        }

        if (goodSignalStartedAt == 0) {
            goodSignalStartedAt = now;
        }

        detectPeak(intensity, now);
        updatePreviewAndQuality();

        long goodFor = now - goodSignalStartedAt;
        String phase = goodFor >= 2_000L ? "measuring" : "waiting_finger";
        emitProgress(phase, null);

        if (goodFor >= MIN_GOOD_SIGNAL_MS) {
            Integer bpm = estimateBpm();
            if (bpm != null && signalQuality >= 0.55) {
                finishSuccess(bpm, signalQuality);
            }
        }
    }

    private void detectPeak(double intensity, long now) {
        double delta = intensity - lastIntensity;
        lastIntensity = intensity;
        if (delta > 0.8) {
            rising = true;
            return;
        }
        if (rising && delta < -0.8) {
            rising = false;
            if (peakTimestamps.isEmpty()
                || now - peakTimestamps.get(peakTimestamps.size() - 1) > 300L) {
                peakTimestamps.add(now);
                if (peakTimestamps.size() > 24) {
                    peakTimestamps.remove(0);
                }
            }
        }
    }

    private void updatePreviewAndQuality() {
        Integer bpm = estimateBpm();
        bpmPreview = bpm;
        if (bpm == null || peakTimestamps.size() < 4) {
            signalQuality = fingerDetected ? 0.25 : 0;
            return;
        }
        double cv = intervalCv(null);
        double base = Math.max(0, 1.0 - cv / MAX_INTERVAL_CV);
        signalQuality = Math.min(1.0, base * (peakTimestamps.size() / 10.0));
    }

    private Integer estimateBpm() {
        if (peakTimestamps.size() < MIN_PEAKS) {
            return null;
        }
        List<Long> intervals = new ArrayList<>();
        for (int i = 1; i < peakTimestamps.size(); i++) {
            long dt = peakTimestamps.get(i) - peakTimestamps.get(i - 1);
            if (dt >= 300L && dt <= 1500L) {
                intervals.add(dt);
            }
        }
        if (intervals.size() < MIN_PEAKS - 1) {
            return null;
        }
        if (intervalCv(intervals) > MAX_INTERVAL_CV) {
            return null;
        }
        double mean = 0;
        for (long value : intervals) {
            mean += value;
        }
        mean /= intervals.size();
        int bpm = (int) Math.round(60_000.0 / mean);
        if (bpm < MIN_BPM || bpm > MAX_BPM) {
            return null;
        }
        return bpm;
    }

    private double intervalCv(List<Long> provided) {
        List<Long> intervals = provided;
        if (intervals == null) {
            intervals = new ArrayList<>();
            for (int i = 1; i < peakTimestamps.size(); i++) {
                intervals.add(peakTimestamps.get(i) - peakTimestamps.get(i - 1));
            }
        }
        if (intervals.size() < 2) {
            return 1;
        }
        double mean = 0;
        for (long value : intervals) {
            mean += value;
        }
        mean /= intervals.size();
        if (mean <= 0) {
            return 1;
        }
        double variance = 0;
        for (long value : intervals) {
            double delta = value - mean;
            variance += delta * delta;
        }
        variance /= intervals.size();
        return Math.sqrt(variance) / mean;
    }

    private void scheduleWatchdog() {
        clearWatchdog();
        watchdog = new Runnable() {
            @Override
            public void run() {
                if (!measuring.get()) {
                    return;
                }
                long elapsed = System.currentTimeMillis() - measureStartedAt;
                if (elapsed >= MAX_DURATION_MS) {
                    Integer bpm = estimateBpm();
                    if (bpm != null && signalQuality >= 0.55 && fingerDetected) {
                        finishSuccess(bpm, signalQuality);
                    } else if (!fingerDetected) {
                        finishFailure(
                            "no_finger",
                            "Doigt non détecté. Recouvre la caméra arrière et le flash."
                        );
                    } else {
                        finishFailure(
                            "insufficient_signal",
                            "Signal insuffisant. Réessaie dans un endroit sombre, doigt bien stable."
                        );
                    }
                    return;
                }
                mainHandler.postDelayed(this, 500L);
            }
        };
        mainHandler.postDelayed(watchdog, 500L);
    }

    private void clearWatchdog() {
        if (watchdog != null) {
            mainHandler.removeCallbacks(watchdog);
            watchdog = null;
        }
    }

    private void finishSuccess(int bpm, double confidence) {
        if (!measuring.compareAndSet(true, false)) {
            return;
        }
        teardownCamera();
        clearWatchdog();
        emitProgress("complete", "Mesure terminée.");
        notifyResult(
            true,
            bpm,
            confidence,
            null,
            "Estimation expérimentale — pas un dispositif médical."
        );
    }

    private void finishFailure(String reason, String message) {
        if (!measuring.compareAndSet(true, false)) {
            return;
        }
        teardownCamera();
        clearWatchdog();
        emitProgress("insufficient_signal", message);
        notifyResult(false, null, null, reason, message);
    }

    private void cancelInternal(String reason, String message) {
        boolean wasMeasuring = measuring.getAndSet(false);
        teardownCamera();
        clearWatchdog();
        if (!wasMeasuring) {
            return;
        }
        emitProgress("cancelled", message);
        notifyResult(false, null, null, reason, message);
    }

    private void teardownCamera() {
        try {
            if (camera != null) {
                try {
                    camera.getCameraControl().enableTorch(false);
                } catch (Exception ignored) {
                    // ignore torch off failures
                }
            }
            if (cameraProvider != null) {
                cameraProvider.unbindAll();
            }
        } catch (Exception e) {
            Log.w(TAG, "teardown", e);
        }
        camera = null;
        if (analysisExecutor != null) {
            analysisExecutor.shutdownNow();
            analysisExecutor = null;
        }
    }

    private void resetSignalState() {
        peakTimestamps.clear();
        lastIntensity = 0;
        rising = false;
        signalQuality = 0;
        fingerDetected = false;
        bpmPreview = null;
        goodSignalStartedAt = 0;
        lastSampleAt = 0;
    }

    private void emitProgress(String phase, String message) {
        JSObject data = new JSObject();
        data.put("phase", phase);
        data.put("signalQuality", signalQuality);
        data.put("fingerDetected", fingerDetected);
        if (bpmPreview != null) {
            data.put("bpmPreview", bpmPreview.intValue());
        }
        data.put(
            "elapsedMs",
            measuring.get() ? System.currentTimeMillis() - measureStartedAt : 0
        );
        if (message != null) {
            data.put("message", message);
        }
        notifyListeners("progress", data);
    }

    private void notifyResult(
        boolean ok,
        Integer bpm,
        Double confidence,
        String reason,
        String message
    ) {
        JSObject data = new JSObject();
        data.put("ok", ok);
        if (bpm != null) {
            data.put("bpm", bpm.intValue());
        }
        if (confidence != null) {
            data.put("confidence", confidence.doubleValue());
        }
        if (reason != null) {
            data.put("reason", reason);
        }
        if (message != null) {
            data.put("message", message);
        }
        notifyListeners("result", data);
    }
}
