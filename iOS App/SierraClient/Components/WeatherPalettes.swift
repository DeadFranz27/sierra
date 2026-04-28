import SwiftUI

// Sierra v2.5 weather palettes — sky gradient + tint + fg colors per condition.
// Mirrors Sierra Design System 2.5/ui_kits/_shared/weather-state.jsx and
// frontend/src/lib/weatherPalettes.ts.

struct WeatherPalette {
    let sky: [Color]      // 3 stops: top → mid → bottom
    let cardTint: Color   // very translucent — for KPI tiles
    let accent: Color
    let fg: Color         // text color on the sky panel
    let shadow: Color     // hero panel shadow tint
    let isDarkSky: Bool   // whether fg is white-on-dark (used for CTA glass)
}

enum WeatherPalettes {
    static func palette(for condition: WeatherCondition) -> WeatherPalette {
        switch condition {
        case .clear:         return .init(sky: [hex(0xFFE9B8), hex(0xFFD089), hex(0xF4A86A)], cardTint: rgba(244, 168, 106, 0.05), accent: hex(0xC0743A), fg: hex(0x3F2615), shadow: rgba(192, 116, 58, 0.18), isDarkSky: false)
        case .partly_cloudy: return .init(sky: [hex(0xE5EEF5), hex(0xD4E2EE), hex(0xF2DCC4)], cardTint: rgba(212, 226, 238, 0.07), accent: hex(0x5A7A92), fg: hex(0x2C3947), shadow: rgba(90, 122, 146, 0.16), isDarkSky: false)
        case .overcast:      return .init(sky: [hex(0xDCE2E8), hex(0xC9D2DB), hex(0xB8C2CC)], cardTint: rgba(184, 194, 204, 0.07), accent: hex(0x566472), fg: hex(0x2A323B), shadow: rgba(86, 100, 114, 0.14), isDarkSky: false)
        case .drizzle:       return .init(sky: [hex(0xC5D2DC), hex(0xA8B9C8), hex(0x8FA3B5)], cardTint: rgba(143, 163, 181, 0.08), accent: hex(0x3F5A6E), fg: hex(0x1F2C38), shadow: rgba(63, 90, 110, 0.18), isDarkSky: false)
        case .heavy_rain:    return .init(sky: [hex(0x8FA1B2), hex(0x6F839A), hex(0x4F6577)], cardTint: rgba(79, 101, 119, 0.07),  accent: hex(0x2D4456), fg: .white,        shadow: rgba(45, 68, 86, 0.28),   isDarkSky: true)
        case .thunderstorm:  return .init(sky: [hex(0x7A8294), hex(0x5C6378), hex(0x3D425A)], cardTint: rgba(61, 66, 90, 0.07),    accent: hex(0xC58E2E), fg: .white,        shadow: rgba(61, 66, 90, 0.32),   isDarkSky: true)
        case .snow:          return .init(sky: [hex(0xF4F7FA), hex(0xE2EBF1), hex(0xCDDAE3)], cardTint: rgba(205, 218, 227, 0.10), accent: hex(0x5C7388), fg: hex(0x2A3744), shadow: rgba(92, 115, 136, 0.14), isDarkSky: false)
        case .hail:          return .init(sky: [hex(0xD7DEE5), hex(0xB6C2CD), hex(0x8E9FAC)], cardTint: rgba(142, 159, 172, 0.07), accent: hex(0x4D6072), fg: hex(0x1F2A35), shadow: rgba(77, 96, 114, 0.18),  isDarkSky: false)
        case .frost:         return .init(sky: [hex(0xEAF2F6), hex(0xD2E1EB), hex(0xB5CCDA)], cardTint: rgba(181, 204, 218, 0.08), accent: hex(0x3E6B85), fg: hex(0x22384A), shadow: rgba(62, 107, 133, 0.16), isDarkSky: false)
        case .heat:          return .init(sky: [hex(0xFFD58A), hex(0xF49C5C), hex(0xD75A3A)], cardTint: rgba(215, 90, 58, 0.06),   accent: hex(0xA33A1F), fg: hex(0x3D1A0F), shadow: rgba(215, 90, 58, 0.22),  isDarkSky: false)
        case .windy:         return .init(sky: [hex(0xE0E6EA), hex(0xC7D2D8), hex(0xA6B4BC)], cardTint: rgba(166, 180, 188, 0.07), accent: hex(0x4F6470), fg: hex(0x26323A), shadow: rgba(79, 100, 112, 0.16), isDarkSky: false)
        case .fog:           return .init(sky: [hex(0xE7E5DF), hex(0xD4D2CC), hex(0xBAB7B0)], cardTint: rgba(186, 183, 176, 0.08), accent: hex(0x605A4E), fg: hex(0x2E2A22), shadow: rgba(96, 90, 78, 0.14),   isDarkSky: false)
        case .night:         return .init(sky: [hex(0x293A52), hex(0x1A2538), hex(0x0E1726)], cardTint: rgba(14, 23, 38, 0.06),    accent: hex(0xC9A86A), fg: hex(0xF5EFE3), shadow: rgba(14, 23, 38, 0.34),   isDarkSky: true)
        case .dust:          return .init(sky: [hex(0xE8C99A), hex(0xC99964), hex(0x9A6736)], cardTint: rgba(154, 103, 54, 0.06),  accent: hex(0x7A4A22), fg: hex(0x2E1B0C), shadow: rgba(154, 103, 54, 0.20), isDarkSky: false)
        case .recovery:      return .init(sky: [hex(0xDEEBE0), hex(0xC2D8C4), hex(0x9DBFA3)], cardTint: rgba(157, 191, 163, 0.07), accent: hex(0x3F6E4B), fg: hex(0x1F3326), shadow: rgba(63, 110, 75, 0.16),  isDarkSky: false)
        }
    }

    static let `default` = palette(for: .partly_cloudy)
}

private func hex(_ rgb: UInt32) -> Color {
    Color(
        red:   Double((rgb >> 16) & 0xFF) / 255.0,
        green: Double((rgb >>  8) & 0xFF) / 255.0,
        blue:  Double( rgb        & 0xFF) / 255.0
    )
}

private func rgba(_ r: Double, _ g: Double, _ b: Double, _ a: Double) -> Color {
    Color(red: r / 255.0, green: g / 255.0, blue: b / 255.0, opacity: a)
}
