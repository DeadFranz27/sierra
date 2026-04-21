import SwiftUI

struct DeviceView: View {
    @EnvironmentObject var client: SierraClient
    @State private var devices: [Device] = []
    @State private var location: HubLocation?
    @State private var isLoading = true
    @State private var showLocationSearch = false
    @State private var geoQuery = ""
    @State private var geoResults: [GeoResult] = []
    @State private var isSearching = false

    private var hub: Device? { devices.first { $0.kind == "hub" } }
    private var sensors: [Device] { devices.filter { $0.kind != "hub" } }

    var body: some View {
        NavigationStack {
            List {
                // Hub card
                Section("Sierra Hub") {
                    HStack(spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12).fill(Color("Moss900"))
                            Image(systemName: "cpu").font(.title2).foregroundStyle(Color("Mist300"))
                        }
                        .frame(width: 48, height: 48)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(hub?.name ?? "Not detected").font(.headline)
                            Text(hub != nil ? "Online" : "Offline")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(hub != nil ? Color("StateGood") : Color("StateBad"))
                        }
                        Spacer()
                        Image(systemName: hub != nil ? "wifi" : "wifi.slash")
                            .foregroundStyle(hub != nil ? Color("StateGood") : Color("StateBad"))
                    }
                    .padding(.vertical, 4)

                    if let h = hub {
                        LabeledContent("Firmware", value: h.firmware_version)
                        LabeledContent("Last seen", value: formatLastSeen(h.last_seen))
                        if let rssi = h.wifi_rssi {
                            LabeledContent("Wi-Fi RSSI", value: "\(Int(rssi)) dBm")
                        }
                    }
                }

                // Location
                Section("Physical location") {
                    if let loc = location {
                        LabeledContent("Location") {
                            Text(loc.label).multilineTextAlignment(.trailing)
                        }
                        LabeledContent("Coordinates") {
                            Text("\(loc.latitude, specifier: "%.4f"), \(loc.longitude, specifier: "%.4f")")
                                .font(.caption.monospacedDigit())
                        }
                    } else {
                        Text("Not set — weather data won't be available.")
                            .font(.footnote).foregroundStyle(Color("FGMuted"))
                    }
                    Button(location == nil ? "Set location" : "Change location") {
                        showLocationSearch = true
                    }
                    .foregroundStyle(Color("Moss700"))
                }

                // Sensors
                if !sensors.isEmpty {
                    Section("Connected sensors") {
                        ForEach(sensors) { s in
                            HStack {
                                Image(systemName: "antenna.radiowaves.left.and.right")
                                    .foregroundStyle(Color("Moss700"))
                                VStack(alignment: .leading) {
                                    Text(s.name).font(.subheadline.weight(.semibold))
                                    Text(formatLastSeen(s.last_seen)).font(.caption).foregroundStyle(Color("FGMuted"))
                                }
                                Spacer()
                                if let rssi = s.wifi_rssi {
                                    Text("\(Int(rssi)) dBm").font(.caption.monospacedDigit()).foregroundStyle(Color("FGMuted"))
                                }
                            }
                        }
                    }
                }

                // Privacy
                Section("Privacy") {
                    Label("No cloud. All data stays on your local network.", systemImage: "lock.shield.fill")
                        .font(.footnote).foregroundStyle(Color("Moss700"))
                    Toggle("Fetch weather from Open-Meteo (anonymous)", isOn: .constant(true))
                        .tint(Color("Moss700"))
                        .font(.footnote)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Device")
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $showLocationSearch) {
                LocationSearchSheet { picked in
                    Task {
                        location = try? await client.setLocation(HubLocation(label: picked.displayLabel, latitude: picked.latitude, longitude: picked.longitude))
                    }
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        async let d = try? client.devices()
        async let loc = try? client.getLocation()
        let (fetchedD, fetchedLoc) = await (d, loc)
        devices = fetchedD ?? []
        location = fetchedLoc ?? nil
        isLoading = false
    }

    private func formatLastSeen(_ iso: String?) -> String {
        guard let iso else { return "Never" }
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fmt.date(from: iso) else { return iso }
        let mins = Int(-date.timeIntervalSinceNow / 60)
        if mins < 2 { return "Just now" }
        if mins < 60 { return "\(mins) min ago" }
        return date.formatted(.dateTime.hour().minute())
    }
}

// MARK: - Location search sheet

struct LocationSearchSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var client: SierraClient
    let onPicked: (GeoResult) -> Void

    @State private var query = ""
    @State private var results: [GeoResult] = []
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            List {
                if results.isEmpty && !isSearching && !query.isEmpty {
                    Text("No results. Try a different city name.")
                        .font(.footnote).foregroundStyle(Color("FGMuted"))
                }
                ForEach(results) { r in
                    Button {
                        onPicked(r)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.name).font(.subheadline.weight(.semibold)).foregroundStyle(Color("FG"))
                            Text([r.admin1, r.country].compactMap { $0 }.joined(separator: ", "))
                                .font(.caption).foregroundStyle(Color("FGMuted"))
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Set location")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search city…")
            .onSubmit(of: .search) { search() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .overlay {
                if isSearching { ProgressView() }
            }
        }
    }

    private func search() {
        guard !query.isEmpty else { return }
        isSearching = true
        Task {
            results = (try? await client.searchGeo(query: query)) ?? []
            isSearching = false
        }
    }
}
