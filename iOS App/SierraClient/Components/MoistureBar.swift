import SwiftUI

struct MoistureBar: View {
    let value: Double?
    var profile: PlantProfile?

    private var fraction: Double {
        guard let v = value else { return 0 }
        return max(0, min(1, v / 100))
    }

    private var barColor: Color {
        guard let v = value else { return Color("FGMuted") }
        if v < (profile?.moisture_dry ?? 40) { return Color("StateWarn") }
        if v > (profile?.moisture_wet ?? 75) { return Color("StateInfo") }
        return Color("StateGood")
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color("BGSunken"))
                Capsule().fill(barColor)
                    .frame(width: geo.size.width * fraction)
            }
        }
        .frame(height: 6)
    }
}
