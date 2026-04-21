import SwiftUI
import Charts

struct SoilSparkline: View {
    let readings: [MoistureReading]
    var height: CGFloat = 100

    @State private var selectedReading: MoistureReading?

    private var chartData: [(index: Int, value: Double, label: String)] {
        readings.enumerated().map { (i, r) in
            (index: i, value: r.value_percent, label: formatLabel(r.timestamp))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let sel = selectedReading {
                HStack(spacing: 4) {
                    Text("\(Int(sel.value_percent))%")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(Color("Moss700"))
                    Text(formatLabel(sel.timestamp))
                        .font(.caption)
                        .foregroundStyle(Color("FGMuted"))
                }
                .transition(.opacity)
            }

            Chart {
                ForEach(chartData, id: \.index) { point in
                    AreaMark(
                        x: .value("Index", point.index),
                        y: .value("Moisture", point.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color("Moss700").opacity(0.3), Color("Moss700").opacity(0)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)

                    LineMark(
                        x: .value("Index", point.index),
                        y: .value("Moisture", point.value)
                    )
                    .foregroundStyle(Color("Moss700"))
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                }

                if let sel = selectedReading, let idx = readings.firstIndex(where: { $0.id == sel.id }) {
                    RuleMark(x: .value("Index", idx))
                        .foregroundStyle(Color("FGMuted").opacity(0.5))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))

                    PointMark(
                        x: .value("Index", idx),
                        y: .value("Moisture", sel.value_percent)
                    )
                    .foregroundStyle(Color("Moss700"))
                    .symbolSize(40)
                }
            }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { val in
                    AxisValueLabel { if let v = val.as(Double.self) { Text("\(Int(v))%").font(.caption2) } }
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                }
            }
            .chartYScale(domain: 0...100)
            .chartOverlay { proxy in
                GeometryReader { geo in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { value in
                                    let relX = value.location.x / geo.size.width
                                    let idx = Int((relX * CGFloat(max(1, readings.count - 1))).rounded())
                                        .clamped(to: 0...(readings.count - 1))
                                    selectedReading = readings[idx]
                                }
                                .onEnded { _ in
                                    withAnimation(.easeOut(duration: 0.3)) { selectedReading = nil }
                                }
                        )
                }
            }
            .frame(height: height)
            .animation(.easeInOut(duration: 0.15), value: selectedReading?.id)
        }
    }

    private func formatLabel(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fmt.date(from: iso) else { return iso }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }
}

extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        max(range.lowerBound, min(range.upperBound, self))
    }
}
