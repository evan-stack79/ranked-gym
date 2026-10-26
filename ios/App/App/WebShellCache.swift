import WebKit

/// Vide le cache WebView (service worker, precache) quand le numéro de build
/// change, pour qu’un nouvel IPA remplace vraiment l’ancienne interface.
/// Le localStorage, IndexedDB et les cookies restent : séances et session.
enum WebShellCache {
    private static let buildKey = "rankedGym.webShellPurgedBuild"

    static func purgeIfBuildChanged(completion: @escaping () -> Void) {
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        let defaults = UserDefaults.standard
        if defaults.string(forKey: buildKey) == build {
            completion()
            return
        }

        var types = WKWebsiteDataStore.allWebsiteDataTypes()
        types.remove(WKWebsiteDataTypeLocalStorage)
        types.remove(WKWebsiteDataTypeIndexedDBDatabases)
        types.remove(WKWebsiteDataTypeCookies)
        types.remove(WKWebsiteDataTypeWebSQLDatabases)

        WKWebsiteDataStore.default().removeData(
            ofTypes: types,
            modifiedSince: Date(timeIntervalSince1970: 0)
        ) {
            defaults.set(build, forKey: buildKey)
            completion()
        }
    }
}
