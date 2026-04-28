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
    @State private var hub: Device?
    @State private var loadError: String?

    // Sierra v2.0 weather state — derived from current-hour Open-Meteo data,
    // motto rotates 3× per day (every ~8h slot) so it doesn't feel frozen.
    private var weatherCondition: WeatherCondition? {
        guard !weatherPoints.isEmpty else { return nil }
        let now = Date()
        let current = weatherPoints
            .filter { $0.timestamp <= now }
            .max(by: { $0.timestamp < $1.timestamp })
        let past24cutoff = now.addingTimeInterval(-24 * 3600)
        let past24 = weatherPoints.filter { $0.timestamp >= past24cutoff }
        let temps = past24.compactMap { $0.temperatureC }
        return WeatherDerive.condition(.init(
            weatherCode: current?.weatherCode,
            isDay: current?.isDay,
            temperatureC: current?.temperatureC,
            tempMinC: temps.min(),
            tempMaxC: temps.max(),
            windKmh: current?.wind,
            precip24hMm: past24.reduce(0) { $0 + $1.rain },
            precipNextMm: current?.rain
        ))
    }

    private var motto: String {
        guard let cond = weatherCondition else { return "Your garden awaits." }
        return WeatherMottos.pickMotto(cond)
    }

    private var soilTone: StatTile.Tone {
        guard let v = soilHistory.last?.value_percent else { return .neutral }
        if v < 25 { return .warn }
        if v > 60 { return .info }
        return .good
    }

    private var dateString: String {
        Date().formatted(.dateTime.weekday(.wide).day().month(.wide).year())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Sierra.Space.s4) {
                    privacyBanner
                        .sierraAppear()

                    if let err = loadError {
                        SierraErrorBanner(message: err) {
                            Task { await load() }
                        }
                        .sierraAppear()
                    }

                    weatherHero
                        .sierraAppear(delay: 0.04)

                    // KPI tiles
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Sierra.Space.s3) {
                        StatTile(label: "Zones", value: "\(zones.count)", sub: "\(zones.filter { $0.active_profile_id != nil }.count) with profile", icon: "drop.fill")
                            .sierraAppear(delay: 0.08)
                        StatTile(label: "Soil moisture", value: soilHistory.last.map { "\(Int($0.value_percent))%" } ?? "—", sub: "Latest reading", icon: "humidity.fill", tone: soilTone)
                            .sierraAppear(delay: 0.10)
                        StatTile(label: "Hub",
                                 value: hub.map { hubLabel($0.status) } ?? "—",
                                 sub: hub != nil ? "Direct connection" : "Not detected",
                                 icon: "cpu",
                                 tone: hubStatTileTone(hub?.status ?? .offline))
                            .sierraAppear(delay: 0.12)
                        StatTile(label: "Profiles", value: "—", sub: "Plant library", icon: "books.vertical.fill")
                            .sierraAppear(delay: 0.14)
                    }

                    // Soil sparkline with display value
                    if !soilHistory.isEmpty {
                        VStack(alignment: .leading, spacing: Sierra.Space.s3) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Soil · 24h").sierraText(.eyebrow)
                                    Text(zones.first?.name ?? "—")
                                        .font(.display(Sierra.TextSize.xl))
                                        .tracking(Sierra.TextSize.xl * Sierra.Tracking.tight)
                                        .foregroundStyle(Sierra.Color.fgBrand)
                                }
                                Spacer()
                                if let last = soilHistory.last {
                                    HStack(alignment: .lastTextBaseline, spacing: 2) {
                                        Text("\(Int(last.value_percent))")
                                            .font(.jetMono(28, weight: .medium))
                                            .foregroundStyle(Sierra.Color.fgBrand)
                                        Text("%")
                                            .font(.manrope(Sierra.TextSize.sm))
                                            .foregroundStyle(Sierra.Color.fgMuted)
                                    }
                                }
                            }
                            SoilSparkline(readings: soilHistory)
                                .frame(height: 140)
                        }
                        .sierraCard()
                        .sierraAppear(delay: 0.18)
                    }

                    // Weather charts
                    weatherCard
                        .sierraAppear(delay: 0.22)

                    // Recent activity
                    if !recentRuns.isEmpty {
                        recentActivityCard
                            .sierraAppear(delay: 0.26)
                    }
                }
                .padding(Sierra.Space.s4)
            }
            .background(Sierra.Color.bg.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .task { await load() }
            .onChange(of: weatherHours) { _, _ in Task { await loadWeather() } }
            .refreshable { await load() }
        }
    }

    // v2.5 ambient sky hero: gradient panel keyed off the current weather palette,
    // with drifting orbs, eyebrow row, italic Instrument Serif motto, mini stat strip
    // and a glass "Run a zone" CTA. Hub badge stays as a trailing accessory above.
    private var weatherHero: some View {
        let palette = WeatherPalettes.palette(for: weatherCondition ?? .partly_cloudy)
        let conditionLabel = (weatherCondition ?? .partly_cloudy)
            .rawValue
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
        let currentTemp = weatherPoints
            .filter { $0.timestamp <= Date() }
            .max(by: { $0.timestamp < $1.timestamp })?
            .temperatureC
        let avgSoil = soilHistory.last.map { Int($0.value_percent) }
        let zonesWithProfile = zones.filter { $0.active_profile_id != nil }.count

        return VStack(alignment: .leading, spacing: 0) {
            // Hub status badge sits above the sky panel — keeps the affordance
            // without fighting the gradient hierarchy.
            HStack {
                Spacer()
                if let h = hub {
                    Badge(label: hubLabel(h.status),
                          tone: hubTone(h.status),
                          pulses: h.status == .online)
                } else {
                    Badge(label: "Offline", tone: .neutral)
                }
            }
            .padding(.bottom, Sierra.Space.s2)

            ZStack {
                // Gradient sky
                LinearGradient(
                    stops: [
                        .init(color: palette.sky[0], location: 0.0),
                        .init(color: palette.sky[1], location: 0.48),
                        .init(color: palette.sky[2], location: 1.0),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                // Drifting orbs
                TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { ctx in
                    let t = ctx.date.timeIntervalSinceReferenceDate
                    Canvas { gctx, size in
                        let phaseA = sin(t / 9.0) // ~18s full cycle
                        let phaseB = sin(t / 11.0) // ~22s
                        let phaseC = sin(t / 13.0) // ~26s

                        gctx.fill(
                            Path(ellipseIn: CGRect(
                                x: size.width - 170 + phaseA * 14,
                                y: -100 + phaseA * 8,
                                width: 340, height: 340
                            )),
                            with: .color(palette.sky[0].opacity(0.55))
                        )
                        gctx.fill(
                            Path(ellipseIn: CGRect(
                                x: -130 + phaseB * -12,
                                y: size.height - 80 + phaseB * -10,
                                width: 380, height: 380
                            )),
                            with: .color(palette.sky[2].opacity(0.5))
                        )
                        gctx.fill(
                            Path(ellipseIn: CGRect(
                                x: size.width * 0.35 + phaseC * 14,
                                y: size.height * 0.3 + phaseC * 8,
                                width: 220, height: 220
                            )),
                            with: .color(.white.opacity(0.4))
                        )
                    }
                    .blur(radius: 40)
                }
                .allowsHitTesting(false)

                // Foreground content
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .center, spacing: Sierra.Space.s4) {
                        if let cond = weatherCondition, !isLoading {
                            WeatherIcon(state: cond, size: 88)
                                .shadow(color: palette.isDarkSky ? .black.opacity(0.25) : .clear,
                                        radius: 6, x: 0, y: 2)
                        } else {
                            WeatherIcon(state: .partly_cloudy, size: 88)
                                .opacity(isLoading ? 0.6 : 1)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text(eyebrowLine(condition: conditionLabel, tempC: currentTemp))
                                .font(.manrope(11, weight: .semibold))
                                .tracking(11 * 0.14)
                                .textCase(.uppercase)
                                .foregroundStyle(palette.fg.opacity(0.7))
                                .lineLimit(1)
                            Text(isLoading ? "Loading…" : motto)
                                .font(.display(34, italic: true))
                                .tracking(34 * Sierra.Tracking.tight)
                                .foregroundStyle(palette.fg)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }

                    // Mini stat strip
                    HStack(spacing: 14) {
                        miniStat(
                            value: avgSoil != nil ? "\(avgSoil!)%" : "—",
                            label: "avg soil",
                            fg: palette.fg
                        )
                        Text("·").foregroundStyle(palette.fg.opacity(0.4))
                        miniStat(
                            value: "\(zones.count)",
                            label: "zones",
                            fg: palette.fg
                        )
                        Text("·").foregroundStyle(palette.fg.opacity(0.4))
                        miniStat(
                            value: "\(zonesWithProfile)",
                            label: "with profile",
                            fg: palette.fg
                        )
                        Spacer(minLength: 0)
                    }
                    .font(.manrope(12.5))

                    // Glass CTA
                    Button {
                        // Hook up to a navigation action when ready.
                    } label: {
                        HStack(spacing: 8) {
                            SierraIcon.play.image(size: 14)
                            Text("Run a zone")
                                .font(.manrope(14, weight: .semibold))
                        }
                        .foregroundStyle(palette.fg)
                        .padding(.horizontal, Sierra.Space.s5)
                        .padding(.vertical, Sierra.Space.s3)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: Sierra.Radius.md, style: .continuous)
                                .fill(palette.isDarkSky
                                      ? Color.white.opacity(0.16)
                                      : Color.white.opacity(0.55))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Sierra.Radius.md, style: .continuous)
                                .strokeBorder(
                                    palette.isDarkSky
                                        ? Color.white.opacity(0.28)
                                        : Color.black.opacity(0.08),
                                    lineWidth: 1
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 22)
            }
            .clipShape(RoundedRectangle(cornerRadius: Sierra.Radius.xl, style: .continuous))
            .shadow(color: palette.shadow, radius: 22, x: 0, y: 18)
        }
        .padding(.bottom, Sierra.Space.s4)
    }

    private func miniStat(value: String, label: String, fg: Color) -> some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.manrope(12.5, weight: .bold))
                .foregroundStyle(fg)
            Text(label)
                .foregroundStyle(fg.opacity(0.7))
        }
    }

    private func eyebrowLine(condition: String, tempC: Double?) -> String {
        var parts = [dateString, condition]
        if let t = tempC { parts.append("\(Int(t.rounded())) °C") }
        return parts.joined(separator: " · ")
    }

    private var privacyBanner: some View {
        HStack(spacing: Sierra.Space.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Sierra.Radius.sm, style: .continuous)
                    .fill(Color.white)
                SierraIcon.lock.image(size: 15)
                    .foregroundStyle(Sierra.Color.fgBrand)
            }
            .frame(width: 28, height: 28)
            (Text("You're connected directly to the Hub. ")
                .font(.manrope(Sierra.TextSize.sm, weight: .semibold))
                .foregroundColor(Sierra.Color.fgBrand)
             + Text("Data never leaves your network.")
                .font(.manrope(Sierra.TextSize.sm))
                .foregroundColor(Sierra.Color.fgMuted)
            )
            .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Sierra.Space.s3 + 2)
        .padding(.vertical, Sierra.Space.s3)
        .background(Sierra.Color.mist300, in: RoundedRectangle(cornerRadius: Sierra.Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Sierra.Radius.md, style: .continuous)
                .strokeBorder(Sierra.Color.moss200, lineWidth: 1)
        )
    }

    private var weatherCard: some View {
        VStack(alignment: .leading, spacing: Sierra.Space.s3) {
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
                WeatherBarChart(points: weatherPoints, valueKey: \.rain, unit: "mm", color: Sierra.Color.water500, hours: weatherHours)
                WeatherBarChart(points: weatherPoints, valueKey: \.wind, unit: "km/h", color: Sierra.Color.stone500, hours: weatherHours)
                Text("Source: Open-Meteo · \(loc.label)")
                    .sierraText(.caption)
            } else {
                SierraEmptyState(
                    icon: .mapPin,
                    title: "No location set",
                    message: "Set a location in Device settings to see weather."
                )
            }
        }
        .sierraCard()
    }

    private var recentActivityCard: some View {
        VStack(alignment: .leading, spacing: Sierra.Space.s3) {
            SectionHeader(title: "Recent activity")
            ForEach(Array(recentRuns.prefix(6).enumerated()), id: \.element.run.id) { idx, item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.zoneName)
                            .font(.manrope(Sierra.TextSize.base, weight: .semibold))
                            .foregroundStyle(Sierra.Color.fg)
                        Text(item.run.skipped ? "Skipped · \(item.run.skip_reason ?? "")" : "\(item.run.trigger.capitalized) run")
                            .sierraText(.caption)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(relativeTime(item.run.started_at))
                            .font(.jetMono(Sierra.TextSize.xs))
                            .foregroundStyle(Sierra.Color.fgMuted)
                        if let d = item.run.duration_min {
                            Text("\(Int(d)) min")
                                .font(.jetMono(Sierra.TextSize.xs))
                                .foregroundStyle(Sierra.Color.fgMuted)
                        }
                    }
                }
                .padding(.vertical, 4)
                if idx < min(recentRuns.count, 6) - 1 {
                    SierraDivider()
                }
            }
        }
        .sierraCard()
    }

    private func hubLabel(_ s: DeviceStatus) -> String {
        switch s {
        case .online:   return "Online"
        case .degraded: return "Degraded"
        case .error:    return "Error"
        case .offline:  return "Offline"
        }
    }

    private func hubTone(_ s: DeviceStatus) -> Badge.Tone {
        switch s {
        case .online:   return .good
        case .degraded: return .warn
        case .error:    return .bad
        case .offline:  return .neutral
        }
    }

    private func hubStatTileTone(_ s: DeviceStatus) -> StatTile.Tone {
        switch s {
        case .online:   return .good
        case .degraded: return .warn
        case .error:    return .bad
        case .offline:  return .neutral
        }
    }

    private func load() async {
        isLoading = true
        withAnimation(Sierra.Motion.snappy) { loadError = nil }
        defer { isLoading = false }

        do {
            async let zonesTask = client.zones()
            async let locTask = client.getLocation()
            async let devicesTask = client.devices()
            let (fetchedZones, fetchedLoc, fetchedDevices) = try await (zonesTask, locTask, devicesTask)
            zones = fetchedZones
            location = fetchedLoc
            hub = fetchedDevices.first { $0.kind == "hub" }
        } catch {
            withAnimation(Sierra.Motion.snappy) {
                loadError = error.localizedDescription
            }
            return
        }

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
