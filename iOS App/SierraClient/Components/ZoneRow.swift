import SwiftUI

struct ZoneRow: View {
    let zone: Zone
    var moisture: Double?

    private var moistureText: String {
        guard let m = moisture else { return "—" }
        return "\(Int(m))%"
    }

    private var moistureColor: Color {
        guard let m = moisture else { return Color("FGMuted") }
        if m < 40 { return Color("StateWarn") }
        if m > 75 { return Color("StateInfo") }
        return Color("StateGood")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(zone.name)
                        .font(.subheadline.weight(.semibold))
                    Text(zone.active_profile?.name ?? "No profile")
                        .font(.caption)
                        .foregroundStyle(Color("FGMuted"))
                }
                Spacer()
                Text(moistureText)
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(moistureColor)
            }

            MoistureBar(value: moisture, profile: zone.active_profile)
        }
        .padding(.vertical, 4)
    }
}
