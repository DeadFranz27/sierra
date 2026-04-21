import SwiftUI

struct ZonesView: View {
    @EnvironmentObject var client: SierraClient
    @State private var zones: [Zone] = []
    @State private var moistures: [String: Double] = [:]
    @State private var isLoading = true
    @State private var showAddZone = false
    @State private var selectedZone: Zone?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading zones…")
                } else if zones.isEmpty {
                    ContentUnavailableView {
                        Label("No zones yet", systemImage: "drop.slash")
                    } description: {
                        Text("Add your first irrigation zone to get started.")
                    } actions: {
                        Button("Add Zone") { showAddZone = true }
                            .buttonStyle(.borderedProminent)
                            .tint(Color("Moss700"))
                    }
                } else {
                    List {
                        ForEach(zones) { zone in
                            NavigationLink(destination: ZoneDetailView(zone: zone)) {
                                ZoneRow(zone: zone, moisture: moistures[zone.id])
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) { deleteZone(zone) } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading) {
                                Button { waterZone(zone) } label: {
                                    Label("Water", systemImage: "drop.fill")
                                }
                                .tint(Color("Moss700"))

                                Button { skipZone(zone) } label: {
                                    Label("Skip", systemImage: "forward.fill")
                                }
                                .tint(.orange)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Zones")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddZone = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddZone) {
                AddZoneSheet { newZone in
                    zones.append(newZone)
                }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        zones = (try? await client.zones()) ?? []
        for z in zones {
            let hist = (try? await client.moistureHistory(zoneId: z.id, hours: 24)) ?? []
            if let last = hist.last { moistures[z.id] = last.value_percent }
        }
    }

    private func deleteZone(_ zone: Zone) {
        Task {
            try? await client.deleteZone(zone.id)
            zones.removeAll { $0.id == zone.id }
        }
    }

    private func waterZone(_ zone: Zone) {
        Task { try? await client.waterZone(zone.id, durationMin: nil) }
    }

    private func skipZone(_ zone: Zone) {
        Task { try? await client.skipNext(zone.id) }
    }
}

// MARK: - Add zone sheet

struct AddZoneSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var client: SierraClient
    var onCreated: (Zone) -> Void

    @State private var name = ""
    @State private var valveId = "valve-01"
    @State private var sensorId = "sense-01"
    @State private var area = ""
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Zone") {
                    TextField("Name", text: $name)
                    TextField("Valve device ID", text: $valveId).autocorrectionDisabled()
                    TextField("Sensor device ID", text: $sensorId).autocorrectionDisabled()
                    TextField("Area m² (optional)", text: $area).keyboardType(.decimalPad)
                }
                if let err = error {
                    Section { Text(err).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Add Zone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { save() }
                        .disabled(name.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            do {
                let body = ZoneCreate(name: name, valve_device_id: valveId, sensor_device_id: sensorId, area_m2: Double(area))
                let zone = try await client.createZone(body)
                onCreated(zone)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isSaving = false
        }
    }
}
