import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Non-regression: IPA safe-area / Dynamic Island stack must stay wired.
 * Root cause of disappearance (Oct 2026): fixes lived only on unmerged
 * test branches (#117 / #119 / radix-on-ciqual) while main kept
 * contentInset: 'automatic' and no StatusBar overlay.
 */
describe('iOS status bar + contentInset contracts', () => {
  it('capacitor.config.ts keeps contentInset never + StatusBar overlay', () => {
    const src = readFileSync(resolve(process.cwd(), 'capacitor.config.ts'), 'utf8')
    expect(src).toMatch(/contentInset:\s*'never'/)
    expect(src).not.toMatch(/contentInset:\s*'automatic'/)
    expect(src).toMatch(/overlaysWebView:\s*true/)
    expect(src).toMatch(/StatusBar\s*:/)
  })

  it('MainViewController locks scrollView contentInsetAdjustmentBehavior to never', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'ios/App/App/MainViewController.swift'),
      'utf8',
    )
    expect(src).toMatch(/contentInsetAdjustmentBehavior\s*=\s*\.never/)
    expect(src).toMatch(/preferredStatusBarStyle/)
    expect(src).toMatch(/SecureStoragePlugin/)
  })

  it('Info.plist lets MainViewController own status bar appearance', () => {
    const src = readFileSync(resolve(process.cwd(), 'ios/App/App/Info.plist'), 'utf8')
    expect(src).toMatch(
      /<key>UIViewControllerBasedStatusBarAppearance<\/key>\s*<true\/>/,
    )
  })

  it('package.json depends on @capacitor/status-bar (MIT)', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }
    expect(pkg.dependencies?.['@capacitor/status-bar']).toBeTruthy()
  })
})
