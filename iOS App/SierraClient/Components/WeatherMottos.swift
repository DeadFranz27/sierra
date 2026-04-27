import Foundation

// Sierra v2.0 weather state → motto mapping.
// Mirrors frontend/src/lib/weather.ts and Sierra Design System 2.0/ui_kits/_shared/weather-state.jsx.

enum WeatherCondition: String, CaseIterable {
    case clear, partly_cloudy, overcast
    case drizzle, heavy_rain, thunderstorm
    case snow, hail, frost
    case heat, windy, fog
    case night, dust, recovery
}

enum WeatherMottos {
    static let table: [WeatherCondition: [String]] = [
        .clear:         ["The garden is quiet.", "Soaking up the sun.", "Long, bright afternoon."],
        .partly_cloudy: ["Light slips through.", "A gentle afternoon, no rush.", "Comfort in the in-between."],
        .overcast:      ["Soft grey day.", "The light is patient today.", "Holding still under cloud."],
        .drizzle:       ["Drinking on its own.", "The sky is helping today.", "A patient soak."],
        .heavy_rain:    ["Sit this one out.", "The sky has it covered.", "Skipping today's run."],
        .thunderstorm:  ["A loud afternoon.", "Holding everything inside.", "Nothing scheduled — for safety."],
        .snow:          ["A white morning.", "Pipes are sleeping. So is Sierra.", "Standing by until thaw."],
        .hail:          ["Tucked in tight.", "Hiding from the sky.", "Tender leaves under cover."],
        .frost:         ["Below the line.", "Lines drained, plants quiet.", "Waiting out the freeze."],
        .heat:          ["Long thirst kind of day.", "Pulling extra water early.", "The sun is doing too much."],
        .windy:         ["Catching its breath.", "Holding the spray for calmer air.", "Wind has the floor."],
        .fog:           ["Wrapped in soft.", "Drinking the morning air.", "Slow start, settled garden."],
        .night:         ["Asleep, but listening.", "Cooling down. Roots resting.", "Quiet after hours."],
        .dust:          ["The air is heavy.", "Letting the leaves rest.", "Skipping the misters today."],
        .recovery:      ["Coming back slowly.", "Soil still full from yesterday.", "Easy day. The ground remembers."],
    ]

    /// Picks one of the 3 mottos for `condition`, rotating ~every 8 hours so the
    /// hero is never frozen on the first variant.
    static func pickMotto(_ condition: WeatherCondition, now: Date = Date()) -> String {
        let mottos = table[condition] ?? ["The garden is quiet."]
        let hour = Calendar.current.component(.hour, from: now)
        let slot = (hour / 8) % mottos.count
        return mottos[slot]
    }
}

struct WeatherDeriveInput {
    var weatherCode: Int? = nil
    var isDay: Bool? = nil
    var temperatureC: Double? = nil
    var tempMinC: Double? = nil
    var tempMaxC: Double? = nil
    var windKmh: Double? = nil
    var precip24hMm: Double? = nil
    var precipNextMm: Double? = nil
}

enum WeatherDerive {
    /// WMO weather code (Open-Meteo) → v2.0 condition.
    static func fromWmoCode(_ code: Int, isDay: Bool) -> WeatherCondition? {
        switch code {
        case 0: return isDay ? .clear : .night
        case 1, 2: return isDay ? .partly_cloudy : .night
        case 3: return .overcast
        case 45, 48: return .fog
        case 51, 53, 55, 56, 57, 61, 80: return .drizzle
        case 63, 65, 66, 67, 81, 82: return .heavy_rain
        case 71, 73, 75, 77, 85, 86: return .snow
        case 95, 96, 99: return .thunderstorm
        default: return nil
        }
    }

    /// Apply v2.0 cheatsheet thresholds on top of the WMO mapping.
    /// Falls back to clear/night when nothing else fits.
    static func condition(_ input: WeatherDeriveInput) -> WeatherCondition {
        let isDay = input.isDay ?? true

        let tMin = input.tempMinC ?? input.temperatureC ?? 99
        if tMin < 2 { return .frost }

        let tMax = input.tempMaxC ?? input.temperatureC ?? 0
        if tMax >= 32 { return .heat }

        let wind = input.windKmh ?? 0
        if wind > 25 { return .windy }

        if let code = input.weatherCode, let mapped = fromWmoCode(code, isDay: isDay) {
            return mapped
        }

        // Recovery: significant rain past 24h but currently dry/clear.
        if (input.precip24hMm ?? 0) >= 8 && (input.precipNextMm ?? 0) < 0.2 {
            return .recovery
        }

        return isDay ? .clear : .night
    }
}
