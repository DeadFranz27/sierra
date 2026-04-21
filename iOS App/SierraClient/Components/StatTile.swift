import SwiftUI

struct StatTile: View {
    enum Tone { case neutral, good, warn, bad, info }

    let label: String
    let value: String
    var sub: String = ""
    var icon: String = "circle.fill"
    var tone: Tone = .neutral

    private var toneColor: Color {
        switch tone {
        case .neutral: return Color("Moss700")
        case .good:    return Color("StateGood")
        case .warn:    return Color("StateWarn")
        case .bad:     return Color("StateBad")
        case .info:    return Color("StateInfo")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(toneColor)
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color("FGMuted"))
                    .textCase(.uppercase)
                    .tracking(0.6)
                    .lineLimit(1)
            }

            Text(value)
                .font(.jetMono(22, weight: .medium))
                .foregroundStyle(Color("FG"))
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            if !sub.isEmpty {
                Text(sub)
                    .font(.caption)
                    .foregroundStyle(Color("FGMuted"))
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}
