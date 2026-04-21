import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject var client: SierraClient
    @State private var zones: [Zone] = []
    @State private var soilHistory: [MoistureReading] = []
    @State private var recentRuns: [(run: Run, zoneName: String)] = []
    @State private var weatherPoints: [WeatherPoint] = []
    @State private var weatherHours = 24
    @State private var location: HubLocation?
    @State private var isLoading = true
    @State private var weatherLoading = false

    private var motto: String {
        guard !weatherPoints.isEmpty else { return "Your garden awaits." }
        let recentRain = weatherPoints.suffix(3).reduce(0) { $0 + $1.rain }
        let totalRain = weatherPoints.reduce(0) { $0 + $1.rain }
        let latestWind = weatherPoints.last?.wind ?? 0
        if recentRain >= 3 { return "Rain is falling — the garden is drinking." }
        if totalRain >= 1  { return "A little rain has visited today." }
        if latestWind >= 40 { return "Strong winds — keep an eye on the garden." }
        if latestWind >= 20 { return "A breeze is blowing through the garden." }
        return "Dry and calm — a good day to water."
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Privacy banner
                    HStack(spacing: 10) {
                        Image(systemName: "lock.shield.fill")
                            .foregroundStyle(Color("Moss700"))
                        Text("Connected directly to your Hub. No cloud.")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Color("Moss700"))
                        Spacer()
                    }
                    .padding(12)
                    .background(Color("Mist300"), in: RoundedRectangle(cornerRadius: 12))

                    // Motto
                    VStack(alignment: .leading, spacing: 4) {
                        Text(Date().formatted(.dateTime.weekday(.wide).day().month(.wide).year()))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color("FGMuted"))
                            .textCase(.uppercase)
                            .tracking(1)
                        Text(isLoading ? "Loading…" : motto)
                            .font(.display(32))
                            .foregroundStyle(Color("Moss700"))
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // KPI tiles
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        StatTile(label: "Zones", value: "\(zones.count)", sub: "\(zones.filter { $0.active_profile_id != nil }.count) with profile", icon: "drop.fill")
                        StatTile(label: "Soil moisture", value: soilHistory.last.map { "\(Int($0.value_percent))%" } ?? "—", sub: "Latest reading", icon: "humidity.fill")
                        StatTile(label: "Hub", value: "Online", sub: "Direct connection", icon: "cpu", tone: .good)
                        StatTile(label: "Profiles", value: "—", sub: "Plant library", icon: "books.vertical.fill")
                    }

                    // Soil sparkline
                    if !soilHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            SectionHeader(title: "Soil moisture · 24h", subtitle: zones.first?.name)
                            SoilSparkline(readings: soilHistory)
                                .frame(height: 100)
                        }
                        .padding(16)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }

                    // Weather charts
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            SectionHeader(title: "Weather", subtitle: location?.label)
                            Spacer()
                            Picker("Window", selection: $weatherHours) {
                                Text("24h").tag(24)
                                Text("7d").tag(168)
                            }
                            .pickerStyle(.segmented)
                            .frame(width: 100)
                        }

                        if weatherLoading {
                            ProgressView().frame(maxWidth: .infinity).padding()
                        } else if let loc = location {
                            WeatherBarChart(points: weatherPoints, valueKey: \.rain, unit: "mm", color: Color(red: 0.09, green: 0.4, blue: 0.75), hours: weatherHours)
                                .frame(height: 100)
                            WeatherBarChart(points: weatherPoints, valueKey: \.wind, unit: "km/h", color: Color(.systemGray), hours: weatherHours)
                                .frame(height: 100)
                            Text("Source: Open-Meteo · \(loc.label)")
                                .font(.caption2)
                                .foregroundStyle(Color("FGMuted"))
                        } else {
                            ContentUnavailableView {
                                Label("No location set", systemImage: "location.slash")
                            } description: {
                                Text("Set a location in Device settings to see weather.")
                            }
                        }
                    }
                    .padding(16)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                    // Recent activity
                    if !recentRuns.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader(title: "Recent activity")
                            ForEach(recentRuns.prefix(6), id: \.run.id) { item in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.zoneName).font(.subheadline.weight(.semibold))
                                        Text(item.run.skipped ? "Skipped · \(item.run.skip_reason ?? "")" : "\(item.run.trigger.capitalized) run")
                                            .font(.caption)
                                            .foregroundStyle(Color("FGMuted"))
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text(relativeTime(item.run.started_at))
                                            .font(.caption.monospacedDigit())
                                            .foregroundStyle(Color("FGMuted"))
                                        if let d = item.run.duration_min {
                                            Text("\(Int(d)) min")
                                                .font(.caption.monospacedDigit())
                                                .foregroundStyle(Color("FGMuted"))
                                        }
                                    }
                                }
                                .padding(.vertical, 4)
                                if item.run.id != recentRuns.prefix(6).last?.run.id {
                                    Divider()
                                }
                            }
                        }
                        .padding(16)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding(16)
            }
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.large)
            .task { await load() }
            .onChange(of: weatherHours) { _, _ in Task { await loadWeather() } }
            .refreshable { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        async let z = try? client.zones()
        async let loc = try? client.getLocation()
        let (fetchedZones, fetchedLoc) = await (z, loc)
        zones = fetchedZones ?? []
        location = fetchedLoc ?? nil
        if let first = zones.first {
            soilHistory = (try? await client.moistureHistory(zoneId: first.id, hours: 24)) ?? []
        }
        var runs: [(Run, String)] = []
        for z in zones {
            let zRuns = (try? await client.runHistory(zoneId: z.id)) ?? []
            runs += zRuns.map { ($0, z.name) }
        }
        recentRuns = runs.sorted { $0.0.started_at > $1.0.started_at }
        await loadWeather()
    }

    private func loadWeather() async {
        guard let loc = location else { return }
        weatherLoading = true
        weatherPoints = (try? await client.fetchWeather(lat: loc.latitude, lon: loc.longitude, hours: weatherHours)) ?? []
        weatherLoading = false
    }

    private func relativeTime(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fmt.date(from: iso) ?? Date()
        return date.formatted(.relative(presentation: .named))
    }
}
