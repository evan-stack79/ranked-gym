import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var didStartWeb = false

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = RankedPalette.background
        window?.overrideUserInterfaceStyle = .dark
        let placeholder = UIViewController()
        placeholder.view.backgroundColor = RankedPalette.background
        window?.rootViewController = placeholder
        window?.makeKeyAndVisible()

        let startWeb = { [weak self] in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if self.didStartWeb { return }
                self.didStartWeb = true
                // MainViewController enregistre Live Activity / RestTimerSound.
                self.window?.rootViewController = MainViewController()
                SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
            }
        }
        // Le SW de la première install sert encore l’ancien JS tant qu’on ne
        // l’efface pas avant d’ouvrir la WebView.
        WebShellCache.purgeIfBuildChanged(completion: startWeb)
        DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: startWeb)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
