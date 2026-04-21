import SwiftUI
import Charts

struct WeatherBarChart: View {
    let points: [WeatherPoint]
    let valueKey: KeyPath<WeatherPoint, Double>
    let unit: String
    let color: Color
    var hours: Int = 24
    var height: CGFloat = 100

    @State private var selectedPoint: WeatherPoint?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let sel = selectedPoint {
                HStack(spacing: 4) {
                    Text(String(format: "%.1f \(unit)", sel[keyPath: valueKey]))
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(color)
                    Text(sel.label)
                        .font(.caption)
                        .foregroundStyle(Color("FGMuted"))
                }
                .transition(.opacity)
            }

            Chart {
                ForEach(points) { pt in
                    BarMark(
                        x: .value("Label", pt.label),
                        y: .value(unit, pt[keyPath: valueKey])
                    )
                    .foregroundStyle(
                        selectedPoint == nil || selectedPoint?.id == pt.id
                            ? color
                            : color.opacity(0.3)
                    )
                    .cornerRadius(3)
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: min(7, points.count))) { _ in
                    AxisValueLabel().font(.caption2)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { val in
                    AxisValueLabel {
                        if let v = val.as(Double.self) { Text("\(Int(v))").font(.caption2) }
                    }
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                }
            }
            .chartOverlay { proxy in
                GeometryReader { _ in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { value in
                                    if let label: String = proxy.value(atX: value.location.x) {
                                        selectedPoint = points.first { $0.label == label }
                                    }
                                }
                                .onEnded { _ in
                                    withAnimation(.easeOut(duration: 0.3)) { selectedPoint = nil }
                                }
                        )
                }
            }
            .frame(height: height)
            .animation(.easeInOut(duration: 0.15), value: selectedPoint?.id)
        }
    }
}
