import SwiftUI

struct ProfileCard: View {
    let profile: PlantProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !profile.description.isEmpty {
                Text(profile.description)
                    .font(.caption)
                    .foregroundStyle(Color("FGMuted"))
            }

            HStack(spacing: 8) {
                ForEach([("Dry", profile.moisture_dry), ("Target", profile.moisture_target), ("Wet", profile.moisture_wet)], id: \.0) { label, val in
                    VStack(spacing: 2) {
                        Text(label)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Color("FGMuted"))
                            .textCase(.uppercase)
                        Text("\(Int(val))%")
                            .font(.system(size: 18, weight: .light, design: .monospaced))
                            .foregroundStyle(Color("Moss700"))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color("BGSunken"), in: RoundedRectangle(cornerRadius: 8))
                }
            }

            HStack(spacing: 16) {
                Label("\(Int(profile.default_run_min)) min run", systemImage: "timer")
                Label("\(Int(profile.min_interval_hours))h interval", systemImage: "clock")
                Label(profile.sun_preference.capitalized, systemImage: "sun.max")
            }
            .font(.caption)
            .foregroundStyle(Color("FGMuted"))
        }
    }
}
