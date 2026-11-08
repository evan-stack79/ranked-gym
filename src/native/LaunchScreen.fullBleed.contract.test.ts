/**
 * IPA letterbox guard — source contract for LaunchScreen.storyboard.
 *
 * Root cause (IPA #131 / iPhone 17): the launch view was a UIImageView with a
 * fixed 375×667 frame and an EMPTY autoresizingMask. iOS then treated that as
 * the app’s design size → black bars top/bottom despite viewport-fit=cover /
 * contentInset never / StatusBar overlay all being correct in the .app.
 *
 * This test fails if we regress to a non-resizable launch root.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const storyboard = readFileSync(
  'ios/App/App/Base.lproj/LaunchScreen.storyboard',
  'utf8',
)

describe('LaunchScreen.storyboard — full-bleed (anti-letterbox)', () => {
  it('does not use UIImageView as the viewController root view', () => {
    // Old bug: <imageView key="view" … width="375" height="667"/> + empty mask.
    expect(storyboard).not.toMatch(/<imageView\s+key="view"/)
  })

  it('pins splash (or fill) with Auto Layout to the root view edges', () => {
    expect(storyboard).toContain('widthSizable="YES"')
    expect(storyboard).toContain('heightSizable="YES"')
    expect(storyboard).toMatch(/firstAttribute="top".*secondAttribute="top"/s)
    expect(storyboard).toMatch(/firstAttribute="bottom".*secondAttribute="bottom"/s)
    expect(storyboard).toMatch(/firstAttribute="leading".*secondAttribute="leading"/s)
    expect(storyboard).toMatch(/firstAttribute="trailing".*secondAttribute="trailing"/s)
  })

  it('is still referenced as the launch storyboard name', () => {
    const plist = readFileSync('ios/App/App/Info.plist', 'utf8')
    expect(plist).toContain('<key>UILaunchStoryboardName</key>')
    expect(plist).toContain('<string>LaunchScreen</string>')
  })
})
