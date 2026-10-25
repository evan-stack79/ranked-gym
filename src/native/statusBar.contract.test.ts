import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = readFileSync('capacitor.config.ts', 'utf8')
const mainVc = readFileSync('ios/App/App/MainViewController.swift', 'utf8')
const plist = readFileSync('ios/App/App/Info.plist', 'utf8')
const layout = readFileSync('src/components/layout/AppLayout.tsx', 'utf8')

describe('Status bar — overlay transparent (IPA)', () => {
  it('déclare StatusBar overlaysWebView dans capacitor.config', () => {
    expect(config).toContain('StatusBar')
    expect(config).toContain('overlaysWebView: true')
    expect(config).toContain("backgroundColor: '#00000000'")
    expect(config).toContain("contentInset: 'never'")
  })

  it('MainViewController : safe-area CSS + status bar light content', () => {
    expect(mainVc).toContain('contentInsetAdjustmentBehavior = .never')
    expect(mainVc).toContain('preferredStatusBarStyle')
    expect(mainVc).toContain('.lightContent')
  })

  it('Info.plist laisse le VC gérer l’apparence', () => {
    expect(plist).toContain('UIViewControllerBasedStatusBarAppearance')
    expect(plist).toMatch(
      /UIViewControllerBasedStatusBarAppearance<\/key>\s*<true\/>/,
    )
  })

  it('header marque : fond opaque seulement sous le logo, pas sur la safe-area', () => {
    expect(layout).toContain('data-brand-header-bg="1"')
    expect(layout).toContain("paddingTop: 'var(--app-safe-area-top")
    // Le calque noir reste dans le relative interne (rangée logo).
    const headerIdx = layout.indexOf('data-app-brand-header="1"')
    const bgIdx = layout.indexOf('data-brand-header-bg="1"')
    expect(headerIdx).toBeGreaterThan(-1)
    expect(bgIdx).toBeGreaterThan(headerIdx)
  })
})
