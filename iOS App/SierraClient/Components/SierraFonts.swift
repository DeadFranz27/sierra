import SwiftUI

extension Font {
    // Instrument Serif — display headings
    static func display(_ size: CGFloat, italic: Bool = false) -> Font {
        .custom(italic ? "InstrumentSerif-Italic" : "InstrumentSerif-Regular", size: size)
    }

    // Manrope — UI body text
    static func manrope(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Manrope", size: size).weight(weight)
    }

    // JetBrains Mono — numbers / code
    static func jetMono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("JetBrainsMono", size: size).weight(weight)
    }
}
