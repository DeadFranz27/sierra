import SwiftUI

struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color("FGMuted"))
                .textCase(.uppercase)
                .tracking(0.8)
            if let sub = subtitle {
                Text("·")
                    .font(.footnote)
                    .foregroundStyle(Color("FGMuted").opacity(0.6))
                Text(sub)
                    .font(.footnote)
                    .foregroundStyle(Color("FGMuted").opacity(0.7))
                    .lineLimit(1)
            }
        }
    }
}

struct DisplayValue: View {
    let value: String
    var font: Font = .title2

    var body: some View {
        Text(value)
            .font(font.weight(.semibold).monospacedDigit())
            .foregroundStyle(Color("FG"))
    }
}

struct EyebrowLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Color("FGMuted"))
            .textCase(.uppercase)
            .tracking(0.6)
    }
}
