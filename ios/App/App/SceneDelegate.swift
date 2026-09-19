import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        for context in connectionOptions.urlContexts {
            RestTimerLiveActivityPlugin.enqueueDeepLink(context.url)
        }
        if let activity = connectionOptions.userActivities.first,
           activity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = activity.webpageURL {
            RestTimerLiveActivityPlugin.enqueueDeepLink(url)
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            RestTimerLiveActivityPlugin.enqueueDeepLink(context.url)
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = userActivity.webpageURL {
            RestTimerLiveActivityPlugin.enqueueDeepLink(url)
        }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
