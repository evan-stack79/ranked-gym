import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/build-ipa.yml', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')
const scene = readFileSync('ios/App/App/SceneDelegate.swift', 'utf8')
const cache = readFileSync('ios/App/App/WebShellCache.swift', 'utf8')

describe('IPA — chaque build remplace le shell web, pas le premier cache', () => {
  it('désinscrit le service worker Workbox dans le build iOS', () => {
    expect(viteConfig).toContain("selfDestroying: process.env.CAPACITOR_BUILD === '1'")
    expect(workflow).toContain('CAPACITOR_BUILD: "1"')
  })

  it('donne un numéro de build nouveau à chaque IPA', () => {
    expect(workflow).toContain('CURRENT_PROJECT_VERSION=${{ github.run_number }}')
  })

  it('vide le cache WebView avant d’ouvrir l’app, sans effacer les données locales', () => {
    expect(scene).toContain('WebShellCache.purgeIfBuildChanged')
    expect(scene).toContain('rootViewController = placeholder')
    expect(scene).toContain('rootViewController = MainViewController()')
    expect(cache).toContain('WKWebsiteDataTypeLocalStorage')
    expect(cache).toContain('WKWebsiteDataTypeIndexedDBDatabases')
    expect(cache).toContain('types.remove(WKWebsiteDataTypeLocalStorage)')
  })
})
