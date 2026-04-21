import SwiftUI

struct FontDebugView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(UIFont.familyNames.sorted(), id: \.self) { family in
                    Text(family).font(.caption.bold())
                    ForEach(UIFont.fontNames(forFamilyName: family).sorted(), id: \.self) { name in
                        Text("  \(name)").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Fonts")
    }
}
