import UIKit
import Capacitor

/// Capacitor host that registers local CAPBridgedPlugin instances under Plugins/.
/// Plain CAPBridgeViewController does not auto-register App-target plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureStoragePlugin())
        bridge?.registerPluginInstance(CameraHeartRatePlugin())
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
