import SwiftUI

// Sierra v2.0 animated weather icon — port of
// Sierra Design System 2.0/ui_kits/_shared/weather-state.jsx.
//
// Each variant is a 48×48 SwiftUI view animated via TimelineView so we never
// touch the main run loop with .repeatForever (which can starve gestures).
// All paths are 1:1 with the SVG sources — see the original JSX file for the
// canonical vectors.

// MARK: - Colors (DS v2.0 weather palette, hardcoded — these are the icon's
// own paint, not the app's theme tokens, so they don't switch with dark mode.)

private enum WC {
    static let sun        = Color(red: 0xC0/255, green: 0x8A/255, blue: 0x3E/255) // #C08A3E
    static let sunFill    = Color(red: 0xDD/255, green: 0xB2/255, blue: 0x77/255) // #DDB277
    static let heatStroke = Color(red: 0xA2/255, green: 0x4B/255, blue: 0x3B/255) // #A24B3B
    static let cloudLine  = Color(red: 0x5B/255, green: 0x6B/255, blue: 0x7A/255) // #5B6B7A
    static let coolLine   = Color(red: 0x7B/255, green: 0x8F/255, blue: 0xA0/255) // #7B8FA0
    static let stormLine  = Color(red: 0x2F/255, green: 0x58/255, blue: 0x66/255) // #2F5866
    static let rainLine   = Color(red: 0x4E/255, green: 0x7A/255, blue: 0x8C/255) // #4E7A8C
    static let dust       = Color(red: 0xA8/255, green: 0x75/255, blue: 0x54/255) // #A87554
    static let cloudFill  = Color(red: 0xE8/255, green: 0xEC/255, blue: 0xEF/255) // #E8ECEF
    static let cloudFillD = Color(red: 0xDD/255, green: 0xE6/255, blue: 0xEB/255) // #DDE6EB
    static let cloudFillH = Color(red: 0xB6/255, green: 0xC8/255, blue: 0xD2/255) // #B6C8D2
    static let snowFill   = Color(red: 0xF0/255, green: 0xF2/255, blue: 0xF4/255) // #F0F2F4
}

// MARK: - Cloud paths (translated from SVG: Q = quadratic curve)

private func stdCloudPath() -> Path {
    var p = Path()
    p.move(to: CGPoint(x: 10, y: 23))
    p.addQuadCurve(to: CGPoint(x: 4, y: 17),  control: CGPoint(x: 4, y: 23))
    p.addQuadCurve(to: CGPoint(x: 10, y: 12), control: CGPoint(x: 4, y: 12))
    p.addQuadCurve(to: CGPoint(x: 18, y: 6),  control: CGPoint(x: 11, y: 6))
    p.addQuadCurve(to: CGPoint(x: 27, y: 6),  control: CGPoint(x: 22, y: 2))
    p.addQuadCurve(to: CGPoint(x: 35, y: 11), control: CGPoint(x: 33, y: 3))
    p.addQuadCurve(to: CGPoint(x: 42, y: 17), control: CGPoint(x: 42, y: 11))
    p.addQuadCurve(to: CGPoint(x: 36, y: 23), control: CGPoint(x: 42, y: 23))
    p.closeSubpath()
    return p
}

private func smallCloudPath() -> Path {
    var p = Path()
    p.move(to: CGPoint(x: 16, y: 32))
    p.addQuadCurve(to: CGPoint(x: 11, y: 27), control: CGPoint(x: 11, y: 32))
    p.addQuadCurve(to: CGPoint(x: 16, y: 22), control: CGPoint(x: 11, y: 22))
    p.addQuadCurve(to: CGPoint(x: 21, y: 17), control: CGPoint(x: 16, y: 17))
    p.addQuadCurve(to: CGPoint(x: 28, y: 16), control: CGPoint(x: 24, y: 13))
    p.addQuadCurve(to: CGPoint(x: 34, y: 19), control: CGPoint(x: 33, y: 14))
    p.addQuadCurve(to: CGPoint(x: 39, y: 25), control: CGPoint(x: 39, y: 19))
    p.addQuadCurve(to: CGPoint(x: 34, y: 32), control: CGPoint(x: 39, y: 32))
    p.closeSubpath()
    return p
}

private func tinyCloudPath() -> Path {
    var p = Path()
    p.move(to: CGPoint(x: 28, y: 22))
    p.addQuadCurve(to: CGPoint(x: 24, y: 18), control: CGPoint(x: 24, y: 22))
    p.addQuadCurve(to: CGPoint(x: 28, y: 14), control: CGPoint(x: 24, y: 14))
    p.addQuadCurve(to: CGPoint(x: 32, y: 10), control: CGPoint(x: 28, y: 10))
    p.addQuadCurve(to: CGPoint(x: 37, y: 10), control: CGPoint(x: 34, y: 7))
    p.addQuadCurve(to: CGPoint(x: 42, y: 14), control: CGPoint(x: 41, y: 9))
    p.addQuadCurve(to: CGPoint(x: 44, y: 18), control: CGPoint(x: 44, y: 14))
    p.addQuadCurve(to: CGPoint(x: 40, y: 22), control: CGPoint(x: 44, y: 22))
    p.closeSubpath()
    return p
}

// MARK: - Public icon

struct WeatherIcon: View {
    let state: WeatherCondition
    var size: CGFloat = 48

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        // Single timeline drives every animated piece via a normalized phase.
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            iconBody(t: reduceMotion ? 0 : t)
                .frame(width: 48, height: 48)
                .scaleEffect(size / 48, anchor: .center)
                .frame(width: size, height: size)
        }
    }

    @ViewBuilder
    private func iconBody(t: Double) -> some View {
        switch state {
        case .clear:         ClearIcon(t: t)
        case .partly_cloudy: PartlyCloudyIcon(t: t)
        case .overcast:      OvercastIcon(t: t)
        case .drizzle:       DrizzleIcon(t: t)
        case .heavy_rain:    HeavyRainIcon(t: t)
        case .thunderstorm:  ThunderstormIcon(t: t)
        case .snow:          SnowIcon(t: t)
        case .hail:          HailIcon(t: t)
        case .frost:         FrostIcon(t: t)
        case .heat:          HeatIcon(t: t)
        case .windy:         WindyIcon(t: t)
        case .fog:           FogIcon(t: t)
        case .night:         NightIcon(t: t)
        case .dust:          DustIcon(t: t)
        case .recovery:      RecoveryIcon(t: t)
        }
    }
}

// MARK: - Animation helpers

/// 0…1 phase that loops every `period` seconds.
private func phase(_ t: Double, period: Double, offset: Double = 0) -> Double {
    let p = (t / period + offset).truncatingRemainder(dividingBy: 1.0)
    return p < 0 ? p + 1 : p
}

/// Sine-like 0…1 oscillator.
private func sineWave(_ t: Double, period: Double, offset: Double = 0) -> Double {
    let phi = 2 * .pi * (t / period + offset)
    return (sin(phi) + 1) / 2
}

/// `sw-rays` keyframe: opacity 0.55 → 1 → 0.55 over 3s.
private func raysOpacity(_ t: Double) -> Double { 0.55 + 0.45 * sineWave(t, period: 3) }

/// `sw-drift` keyframe: -2 → 2 → -2px over 6s.
private func driftX(_ t: Double, range: Double = 2, period: Double = 6) -> Double {
    return -range + 2 * range * sineWave(t, period: period)
}

/// `sw-rotate` keyframe: 0 → 360° over 22s.
private func rotation(_ t: Double, period: Double = 22) -> Angle {
    .degrees(((t / period).truncatingRemainder(dividingBy: 1.0)) * 360)
}

/// `sw-rain` keyframe envelope. Returns (translateY, opacity) for phase 0…1.
/// 0 → opacity 0, 0.2 → 1, 0.8 → 1, 1.0 → 0; ty 0 → 14.
private func rainEnvelope(_ p: Double) -> (ty: Double, opacity: Double) {
    let ty = 14 * p
    let op: Double
    switch p {
    case ..<0.2:  op = p / 0.2
    case ..<0.8:  op = 1
    default:      op = max(0, 1 - (p - 0.8) / 0.2)
    }
    return (ty, op)
}

/// `sw-snow` keyframe: 0 → opacity 0, 0.25 → 1, 0.75 → 1, 1 → 0; ty 0 → 14, tx 0 → 2.
private func snowEnvelope(_ p: Double) -> (ty: Double, tx: Double, opacity: Double) {
    let ty = 14 * p
    let tx = 2 * p
    let op: Double
    switch p {
    case ..<0.25: op = p / 0.25
    case ..<0.75: op = 1
    default:      op = max(0, 1 - (p - 0.75) / 0.25)
    }
    return (ty, tx, op)
}

/// `sw-hail` keyframe: ty -2 → 14; opacity 0 at p=0, 1 at p=0.3+, fades to 0 at p=1.
private func hailEnvelope(_ p: Double) -> (ty: Double, opacity: Double) {
    let ty = -2 + 16 * p
    let op: Double = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
    return (ty, max(0, op))
}

/// `sw-bolt` keyframe: visible only briefly around p≈0.9.
private func boltOpacity(_ p: Double) -> Double {
    switch p {
    case 0.88...0.90: return (p - 0.88) / 0.02            // ramp up
    case 0.90...0.92: return 1 - (p - 0.90) / 0.02 * 0.8  // fade to 0.2
    case 0.92...0.94: return 0.2 + (p - 0.92) / 0.02 * 0.8
    case 0.94...0.96: return 1 - (p - 0.94) / 0.02 * 0.6
    case 0.96...0.98: return 0.4 + (p - 0.96) / 0.02 * 0.6
    case 0.98...1.0:  return 1 - (p - 0.98) / 0.02
    default:          return 0
    }
}

// MARK: - Variants

private struct ClearIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            // 8 rays
            Group {
                Path { p in
                    p.move(to: .init(x: 24, y: 6));  p.addLine(to: .init(x: 24, y: 10))
                    p.move(to: .init(x: 24, y: 38)); p.addLine(to: .init(x: 24, y: 42))
                    p.move(to: .init(x: 6, y: 24));  p.addLine(to: .init(x: 10, y: 24))
                    p.move(to: .init(x: 38, y: 24)); p.addLine(to: .init(x: 42, y: 24))
                    p.move(to: .init(x: 11, y: 11)); p.addLine(to: .init(x: 14, y: 14))
                    p.move(to: .init(x: 34, y: 34)); p.addLine(to: .init(x: 37, y: 37))
                    p.move(to: .init(x: 37, y: 11)); p.addLine(to: .init(x: 34, y: 14))
                    p.move(to: .init(x: 14, y: 34)); p.addLine(to: .init(x: 11, y: 37))
                }
                .stroke(WC.sun, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            .opacity(raysOpacity(t))

            // sun core
            Circle().path(in: CGRect(x: 16, y: 16, width: 16, height: 16))
                .fill(WC.sunFill.opacity(0.25))
            Circle().path(in: CGRect(x: 16, y: 16, width: 16, height: 16))
                .stroke(WC.sun, lineWidth: 2)
        }
        .rotationEffect(rotation(t), anchor: .center)
        .frame(width: 48, height: 48)
    }
}

private struct PartlyCloudyIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            // small sun upper-left
            Group {
                Path { p in
                    p.move(to: .init(x: 16, y: 6)); p.addLine(to: .init(x: 16, y: 9))
                    p.move(to: .init(x: 6, y: 16)); p.addLine(to: .init(x: 9, y: 16))
                    p.move(to: .init(x: 9, y: 9));  p.addLine(to: .init(x: 11, y: 11))
                }
                .stroke(WC.sun, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            .opacity(raysOpacity(t))

            Circle().path(in: CGRect(x: 10, y: 10, width: 12, height: 12))
                .fill(WC.sunFill.opacity(0.3))
            Circle().path(in: CGRect(x: 10, y: 10, width: 12, height: 12))
                .stroke(WC.sun, lineWidth: 2)

            smallCloudPath()
                .fill(Color.white)
            smallCloudPath()
                .stroke(WC.cloudLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
        }
        .offset(x: driftX(t), y: 0)
        .frame(width: 48, height: 48)
    }
}

private struct OvercastIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            stdCloudPath().fill(WC.cloudFill)
            stdCloudPath().stroke(WC.cloudLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
        }
        .offset(x: driftX(t))
        .frame(width: 48, height: 48)
    }
}

private struct DrizzleIcon: View {
    let t: Double
    var body: some View {
        let p1 = phase(t, period: 1.4)
        let p2 = phase(t, period: 1.4, offset: 0.4 / 1.4)
        let p3 = phase(t, period: 1.4, offset: 0.8 / 1.4)
        ZStack {
            stdCloudPath().fill(WC.cloudFillD)
            stdCloudPath().stroke(WC.rainLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))

            rainStreak(start: .init(x: 16, y: 30), end: .init(x: 14, y: 38), color: WC.rainLine, w: 2, env: rainEnvelope(p1))
            rainStreak(start: .init(x: 24, y: 30), end: .init(x: 22, y: 38), color: WC.rainLine, w: 2, env: rainEnvelope(p2))
            rainStreak(start: .init(x: 32, y: 30), end: .init(x: 30, y: 38), color: WC.rainLine, w: 2, env: rainEnvelope(p3))
        }
        .frame(width: 48, height: 48)
    }
}

private struct HeavyRainIcon: View {
    let t: Double
    var body: some View {
        let p1 = phase(t, period: 1.4)
        let p2 = phase(t, period: 1.4, offset: 0.4 / 1.4)
        let p3 = phase(t, period: 1.4, offset: 0.8 / 1.4)
        let p4 = phase(t, period: 1.4, offset: 0.2 / 1.4)
        ZStack {
            stdCloudPath().fill(WC.cloudFillH)
            stdCloudPath().stroke(WC.stormLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))

            rainStreak(start: .init(x: 14, y: 30), end: .init(x: 11, y: 40), color: WC.stormLine, w: 2.5, env: rainEnvelope(p1))
            rainStreak(start: .init(x: 20, y: 30), end: .init(x: 17, y: 40), color: WC.stormLine, w: 2.5, env: rainEnvelope(p2))
            rainStreak(start: .init(x: 26, y: 30), end: .init(x: 23, y: 40), color: WC.stormLine, w: 2.5, env: rainEnvelope(p3))
            rainStreak(start: .init(x: 32, y: 30), end: .init(x: 29, y: 40), color: WC.stormLine, w: 2.5, env: rainEnvelope(p4))
        }
        .frame(width: 48, height: 48)
    }
}

private func rainStreak(start: CGPoint, end: CGPoint, color: Color, w: Double, env: (ty: Double, opacity: Double)) -> some View {
    Path { p in
        p.move(to: start); p.addLine(to: end)
    }
    .stroke(color, style: StrokeStyle(lineWidth: w, lineCap: .round))
    .offset(x: 0, y: env.ty)
    .opacity(env.opacity)
    .frame(width: 48, height: 48)
}

private struct ThunderstormIcon: View {
    let t: Double
    var body: some View {
        let bp = phase(t, period: 3.5)
        let cloudFillOp = 0.85 + 0.15 * sineWave(t, period: 3.5)
        ZStack {
            stdCloudPath().fill(WC.cloudFill.opacity(cloudFillOp))
            stdCloudPath().stroke(WC.cloudLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
                .offset(x: driftX(t))

            // bolt
            Path { p in
                p.move(to: .init(x: 22, y: 25))
                p.addLine(to: .init(x: 17, y: 33))
                p.addLine(to: .init(x: 22, y: 33))
                p.addLine(to: .init(x: 19, y: 42))
                p.addLine(to: .init(x: 29, y: 29))
                p.addLine(to: .init(x: 24, y: 29))
                p.addLine(to: .init(x: 27, y: 23))
                p.closeSubpath()
            }
            .fill(WC.sunFill)
            Path { p in
                p.move(to: .init(x: 22, y: 25))
                p.addLine(to: .init(x: 17, y: 33))
                p.addLine(to: .init(x: 22, y: 33))
                p.addLine(to: .init(x: 19, y: 42))
                p.addLine(to: .init(x: 29, y: 29))
                p.addLine(to: .init(x: 24, y: 29))
                p.addLine(to: .init(x: 27, y: 23))
                p.closeSubpath()
            }
            .stroke(WC.sun, style: StrokeStyle(lineWidth: 1.8, lineJoin: .round))
            .opacity(boltOpacity(bp))
        }
        .frame(width: 48, height: 48)
    }
}

private struct SnowIcon: View {
    let t: Double
    var body: some View {
        let p1 = phase(t, period: 2.2)
        let p2 = phase(t, period: 2.2, offset: 0.55 / 2.2)
        let p3 = phase(t, period: 2.2, offset: 1.1 / 2.2)
        ZStack {
            stdCloudPath().fill(WC.snowFill)
            stdCloudPath().stroke(WC.cloudLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))

            snowflake(at: .init(x: 14, y: 31), env: snowEnvelope(p1))
            snowflake(at: .init(x: 24, y: 33), env: snowEnvelope(p2))
            snowflake(at: .init(x: 34, y: 31), env: snowEnvelope(p3))
        }
        .frame(width: 48, height: 48)
    }
}

private func snowflake(at c: CGPoint, env: (ty: Double, tx: Double, opacity: Double)) -> some View {
    Path { p in
        // vertical
        p.move(to: .init(x: c.x, y: c.y - 3)); p.addLine(to: .init(x: c.x, y: c.y + 3))
        // horizontal
        p.move(to: .init(x: c.x - 3, y: c.y)); p.addLine(to: .init(x: c.x + 3, y: c.y))
        // diagonals
        p.move(to: .init(x: c.x - 2, y: c.y - 2)); p.addLine(to: .init(x: c.x + 2, y: c.y + 2))
        p.move(to: .init(x: c.x + 2, y: c.y - 2)); p.addLine(to: .init(x: c.x - 2, y: c.y + 2))
    }
    .stroke(WC.coolLine, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
    .offset(x: env.tx, y: env.ty)
    .opacity(env.opacity)
    .frame(width: 48, height: 48)
}

private struct HailIcon: View {
    let t: Double
    var body: some View {
        let p1 = phase(t, period: 1.6)
        let p2 = phase(t, period: 1.6, offset: 0.5 / 1.6)
        let p3 = phase(t, period: 1.6, offset: 1.0 / 1.6)
        ZStack {
            stdCloudPath().fill(WC.cloudFillD)
            stdCloudPath().stroke(WC.cloudLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))

            hailDot(at: .init(x: 14, y: 32), env: hailEnvelope(p1))
            hailDot(at: .init(x: 24, y: 34), env: hailEnvelope(p2))
            hailDot(at: .init(x: 34, y: 32), env: hailEnvelope(p3))
        }
        .frame(width: 48, height: 48)
    }
}

private func hailDot(at c: CGPoint, env: (ty: Double, opacity: Double)) -> some View {
    Group {
        Circle().path(in: CGRect(x: c.x - 2.4, y: c.y - 2.4, width: 4.8, height: 4.8))
            .fill(Color.white)
        Circle().path(in: CGRect(x: c.x - 2.4, y: c.y - 2.4, width: 4.8, height: 4.8))
            .stroke(WC.coolLine, lineWidth: 1.5)
    }
    .offset(x: 0, y: env.ty)
    .opacity(env.opacity)
    .frame(width: 48, height: 48)
}

private struct FrostIcon: View {
    let t: Double
    var body: some View {
        let op = 0.85 + 0.15 * sineWave(t, period: 3)
        ZStack {
            Path { p in
                p.move(to: .init(x: 16, y: 14))
                p.addLine(to: .init(x: 20, y: 20))
                p.addLine(to: .init(x: 16, y: 26))
                p.addLine(to: .init(x: 20, y: 32))
                p.addLine(to: .init(x: 16, y: 38))

                p.move(to: .init(x: 28, y: 14))
                p.addLine(to: .init(x: 32, y: 20))
                p.addLine(to: .init(x: 28, y: 26))
                p.addLine(to: .init(x: 32, y: 32))
                p.addLine(to: .init(x: 28, y: 38))
            }
            .stroke(WC.coolLine, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            .opacity(op)

            Circle().path(in: CGRect(x: 20.5, y: 22.5, width: 7, height: 7))
                .fill(Color.white)
            Circle().path(in: CGRect(x: 20.5, y: 22.5, width: 7, height: 7))
                .stroke(WC.rainLine, lineWidth: 2)
        }
        .frame(width: 48, height: 48)
    }
}

private struct HeatIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            Group {
                Path { p in
                    p.move(to: .init(x: 24, y: 4));  p.addLine(to: .init(x: 24, y: 8))
                    p.move(to: .init(x: 24, y: 36)); p.addLine(to: .init(x: 24, y: 40))
                    p.move(to: .init(x: 4, y: 22));  p.addLine(to: .init(x: 8, y: 22))
                    p.move(to: .init(x: 36, y: 22)); p.addLine(to: .init(x: 40, y: 22))
                    p.move(to: .init(x: 9, y: 7));   p.addLine(to: .init(x: 12, y: 10))
                    p.move(to: .init(x: 32, y: 32)); p.addLine(to: .init(x: 35, y: 35))
                    p.move(to: .init(x: 35, y: 7));  p.addLine(to: .init(x: 32, y: 10))
                    p.move(to: .init(x: 12, y: 32)); p.addLine(to: .init(x: 9, y: 35))
                }
                .stroke(WC.heatStroke, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            .opacity(raysOpacity(t))

            Circle().path(in: CGRect(x: 13, y: 13, width: 18, height: 18))
                .fill(WC.sun.opacity(0.4))
            Circle().path(in: CGRect(x: 13, y: 13, width: 18, height: 18))
                .stroke(WC.heatStroke, lineWidth: 2)
        }
        .rotationEffect(rotation(t), anchor: .init(x: 22.0/48.0, y: 22.0/48.0))
        .frame(width: 48, height: 48)
    }
}

private struct WindyIcon: View {
    let t: Double
    var body: some View {
        // dashed-line offset oscillates -8 → 0 over 1.6s
        let off = -8 + 8 * sineWave(t, period: 1.6)
        ZStack {
            Path { p in
                p.move(to: .init(x: 8, y: 16))
                p.addCurve(to: .init(x: 22, y: 12), control1: .init(x: 14, y: 16), control2: .init(x: 16, y: 12))
                p.addCurve(to: .init(x: 36, y: 16), control1: .init(x: 28, y: 12), control2: .init(x: 30, y: 16))
                p.addLine(to: .init(x: 42, y: 16))
            }
            .stroke(WC.coolLine, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: [4, 4], dashPhase: off))

            Path { p in
                p.move(to: .init(x: 8, y: 24))
                p.addCurve(to: .init(x: 26, y: 20), control1: .init(x: 16, y: 24), control2: .init(x: 18, y: 20))
                p.addCurve(to: .init(x: 42, y: 24), control1: .init(x: 32, y: 20), control2: .init(x: 34, y: 24))
            }
            .stroke(WC.coolLine, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: [4, 4], dashPhase: off))

            Path { p in
                p.move(to: .init(x: 8, y: 32))
                p.addCurve(to: .init(x: 22, y: 28), control1: .init(x: 14, y: 32), control2: .init(x: 16, y: 28))
                p.addLine(to: .init(x: 34, y: 28))
            }
            .stroke(WC.coolLine, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: [4, 4], dashPhase: off))
        }
        .frame(width: 48, height: 48)
    }
}

private struct FogIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            mistLine(start: .init(x: 6, y: 14),  end: .init(x: 34, y: 14), t: t, offset: 0)
            mistLine(start: .init(x: 10, y: 20), end: .init(x: 42, y: 20), t: t, offset: 1.5 / 4.5)
            mistLine(start: .init(x: 6, y: 26),  end: .init(x: 36, y: 26), t: t, offset: 0)
            mistLine(start: .init(x: 10, y: 32), end: .init(x: 40, y: 32), t: t, offset: 1.5 / 4.5)
            mistLine(start: .init(x: 6, y: 38),  end: .init(x: 34, y: 38), t: t, offset: 0)
        }
        .frame(width: 48, height: 48)
    }
}

private func mistLine(start: CGPoint, end: CGPoint, t: Double, offset: Double, color: Color = WC.coolLine, width: Double = 2) -> some View {
    let p = sineWave(t, period: 4.5, offset: offset)
    let dx = -0 + 3 * p
    let opacity = 0.6 + 0.4 * p
    return Path { path in
        path.move(to: start); path.addLine(to: end)
    }
    .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round))
    .offset(x: dx)
    .opacity(opacity)
    .frame(width: 48, height: 48)
}

private struct NightIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            // tiny drifting cloud
            ZStack {
                tinyCloudPath().fill(Color.white)
                tinyCloudPath().stroke(WC.coolLine, style: StrokeStyle(lineWidth: 1.8, lineJoin: .round))
            }
            .offset(x: driftX(t, range: 1.5, period: 9))

            // moon
            Circle().path(in: CGRect(x: 9, y: 11, width: 22, height: 22))
                .fill(WC.cloudFill)
            Circle().path(in: CGRect(x: 9, y: 11, width: 22, height: 22))
                .stroke(WC.cloudLine, lineWidth: 2)

            // craters
            Circle().path(in: CGRect(x: 12.5, y: 15.5, width: 5, height: 5)).fill(WC.coolLine)
            Circle().path(in: CGRect(x: 22.2, y: 22.2, width: 3.6, height: 3.6)).fill(WC.coolLine)
            Circle().path(in: CGRect(x: 21.8, y: 27.8, width: 2.4, height: 2.4)).fill(WC.coolLine)
        }
        .frame(width: 48, height: 48)
    }
}

private struct DustIcon: View {
    let t: Double
    var body: some View {
        ZStack {
            dustWave(y: 14, t: t, offset: 0)
            dustWave(y: 22, t: t, offset: 1.5 / 4.5)
            dustWave(y: 30, t: t, offset: 0)
            dustWave(y: 38, t: t, offset: 1.5 / 4.5)
        }
        .frame(width: 48, height: 48)
    }
}

private func dustWave(y: CGFloat, t: Double, offset: Double) -> some View {
    let p = sineWave(t, period: 4.5, offset: offset)
    let dx = 3 * p
    let opacity = 0.6 + 0.4 * p
    return Path { path in
        path.move(to: .init(x: 6, y: y))
        path.addCurve(to: .init(x: 24, y: y), control1: .init(x: 12, y: y - 2), control2: .init(x: 18, y: y + 2))
        path.addCurve(to: .init(x: 42, y: y), control1: .init(x: 30, y: y - 2), control2: .init(x: 36, y: y + 2))
    }
    .stroke(WC.dust, style: StrokeStyle(lineWidth: 2, lineCap: .round))
    .offset(x: dx)
    .opacity(opacity)
    .frame(width: 48, height: 48)
}

private struct RecoveryIcon: View {
    let t: Double
    var body: some View {
        let op = 0.85 + 0.15 * sineWave(t, period: 3)
        ZStack {
            stdCloudPath().fill(Color.white)
            stdCloudPath().stroke(WC.cloudLine, style: StrokeStyle(lineWidth: 2, lineJoin: .round))

            // sunburst lozenge: a soft horizontal "halo"
            Path { p in
                p.move(to: .init(x: 14, y: 30))
                p.addQuadCurve(to: .init(x: 34, y: 30), control: .init(x: 24, y: 24))
                p.addQuadCurve(to: .init(x: 14, y: 30), control: .init(x: 24, y: 36))
                p.closeSubpath()
            }
            .stroke(WC.sun, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            .opacity(op)
        }
        .offset(x: driftX(t))
        .frame(width: 48, height: 48)
    }
}
