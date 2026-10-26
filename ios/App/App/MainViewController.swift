import UIKit
import Capacitor
import WebKit

/// Capacitor host that registers local CAPBridgedPlugin instances under Plugins/.
/// Plain CAPBridgeViewController does not auto-register App-target plugins.
class MainViewController: CAPBridgeViewController {
    override open func viewDidLoad() {
        super.viewDidLoad()
        // Full-bleed under the status bar — CSS owns safe-area padding.
        if let scrollView = webView?.scrollView {
            scrollView.contentInsetAdjustmentBehavior = .never
        }
        view.backgroundColor = RankedPalette.background
        webView?.isOpaque = false
        webView?.backgroundColor = RankedPalette.background
        webView?.scrollView.backgroundColor = RankedPalette.background
    }

    override open var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override open var prefersStatusBarHidden: Bool {
        false
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureStoragePlugin())
        bridge?.registerPluginInstance(CameraHeartRatePlugin())
        bridge?.registerPluginInstance(LiveActivityPlugin())
        bridge?.registerPluginInstance(RestTimerSoundPlugin())
    }
}
