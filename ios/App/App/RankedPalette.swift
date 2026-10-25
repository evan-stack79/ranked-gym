import UIKit

/// Palette Radix custom Ranked Gym (Dark) — même source que le web.
/// https://www.radix-ui.com/colors/custom?accent-light=DD0600&accent-dark=FF0702&gray-dark=99A1A6&bg-dark=000000
enum RankedPalette {
    static let red9 = color(0xFF0702)
    static let gray1 = color(0x000000)
    static let gray3 = color(0x1D1F20)
    static let gray11 = color(0xACB4BA)
    static let gray12 = color(0xECEEEF)

    static let brand = red9
    static let background = gray1
    static let surface = gray3
    static let muted = gray11
    static let foreground = gray12

    private static func color(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
