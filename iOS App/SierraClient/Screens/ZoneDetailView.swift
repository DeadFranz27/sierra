import SwiftUI
import Charts

struct ZoneDetailView: View {
    let zone: Zone
    @EnvironmentObject var client: SierraClient
    @Environment(\.dismiss) var dismiss

    @State private var currentZone: Zone
    @State private var history: [MoistureReading] = []
    @State private var historyHours = 24
    @State private var runs: [Run] = []
    @State private var schedules: [Schedule] = []
    @State private var profiles: [PlantProfile] = []
    @State private var isLoading = true
    @State private var isWatering = false
    @State private var showWaterSheet = false
    @State private var showProfilePicker = false
    @State private var showAddSchedule = false
    @State private var editingName = false
    @State private var nameInput = ""

    init(zone: Zone) {
        self.zone = zone
        _currentZone = State(initialValue: zone)
    }

    private var latestMoisture: Double? { history.last?.value_percent }
    private var latestTemp: Double? { history.last?.temp_c }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // KPI row
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    StatTile(label: "Soil moisture",
                             value: latestMoisture.map { "\(Int($0))%" } ?? "—",
                             sub: moistureLabel,
                             icon: "humidity.fill",
                             tone: moistureTone)
                    StatTile(label: "Temperature",
                             value: latestTemp.map { "\(Int($0))°C" } ?? "—",
                             sub: "Latest reading",
                             icon: "thermometer.medium")
                    StatTile(label: "Profile",
                             value: currentZone.active_profile?.name ?? "None",
                             sub: currentZone.active_profile.map { "\(Int($0.moisture_target))% target" } ?? "Assign a profile",
                             icon: "leaf.fill")
                    StatTile(label: "Stage",
                             value: currentZone.growth_stage.capitalized,
                             sub: "Growth stage",
                             icon: "sprout.fill")
                }

                // Soil sparkline
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        SectionHeader(title: "Soil moisture")
                        Spacer()
                        Picker("Hours", selection: $historyHours) {
                            Text("24h").tag(24)
                            Text("7d").tag(168)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 100)
                    }
                    if history.isEmpty {
                        Text("No readings yet").font(.footnote).foregroundStyle(Color("FGMuted")).frame(maxWidth: .infinity).padding()
                    } else {
                        SoilSparkline(readings: history).frame(height: 100)
                    }
                }
                .padding(16)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                // Profile card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        SectionHeader(title: "Plant profile")
                        Spacer()
                        Button(showProfilePicker ? "Done" : "Change") {
                            showProfilePicker.toggle()
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color("Moss700"))
                    }

                    if showProfilePicker {
                        ForEach(profiles) { p in
                            Button {
                                assignProfile(p.id)
                                showProfilePicker = false
                            } label: {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(p.name).font(.subheadline.weight(.semibold))
                                        Text("\(Int(p.moisture_target))% target").font(.caption).foregroundStyle(Color("FGMuted"))
                                    }
                                    Spacer()
                                    if currentZone.active_profile_id == p.id {
                                        Image(systemName: "checkmark").foregroundStyle(Color("Moss700"))
                                    }
                                }
                                .padding(10)
                                .background(currentZone.active_profile_id == p.id ? Color("Mist300") : Color("BGSunken"), in: RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    } else if let profile = currentZone.active_profile {
                        ProfileCard(profile: profile)
                    } else {
                        Text("No profile assigned.").font(.subheadline).foregroundStyle(Color("FGMuted"))
                    }

                    // Growth stage
                    Divider()
                    Text("Growth stage").font(.caption.weight(.semibold)).foregroundStyle(Color("FGMuted")).textCase(.uppercase).tracking(0.8)
                    HStack(spacing: 8) {
                        ForEach(["seedling", "established", "dormant"], id: \.self) { stage in
                            Button(stage.capitalized) {
                                Task {
                                    if let updated = try? await client.setGrowthStage(zoneId: currentZone.id, stage: stage) {
                                        currentZone = updated
                                    }
                                }
                            }
                            .font(.subheadline.weight(currentZone.growth_stage == stage ? .semibold : .regular))
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(currentZone.growth_stage == stage ? Color("Moss700") : Color("BGSunken"), in: Capsule())
                            .foregroundStyle(currentZone.growth_stage == stage ? .white : Color("FG"))
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                // Schedules
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        SectionHeader(title: "Schedules")
                        Spacer()
                        Button { showAddSchedule = true } label: {
                            Image(systemName: "plus.circle.fill").foregroundStyle(Color("Moss700"))
                        }
                    }
                    if schedules.isEmpty {
                        Text("No schedules. Tap + to add one.").font(.footnote).foregroundStyle(Color("FGMuted"))
                    }
                    ForEach(schedules) { sched in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(dayNames(sched.days_of_week) + " · " + sched.time_local)
                                    .font(.subheadline.weight(.semibold))
                                Text("\(Int(sched.duration_min)) min\(sched.smart ? " · smart" : "")")
                                    .font(.caption).foregroundStyle(Color("FGMuted"))
                            }
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { sched.enabled },
                                set: { _ in toggleSchedule(sched) }
                            ))
                            .labelsHidden()
                            .tint(Color("Moss700"))

                            Button(role: .destructive) { deleteSchedule(sched) } label: {
                                Image(systemName: "trash").foregroundStyle(.red)
                            }
                            .buttonStyle(.plain)
                        }
                        .opacity(sched.enabled ? 1 : 0.5)
                        .padding(.vertical, 4)
                        if sched.id != schedules.last?.id { Divider() }
                    }
                }
                .padding(16)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                // Run history
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "Run history")
                    if runs.isEmpty {
                        Text("No runs yet.").font(.footnote).foregroundStyle(Color("FGMuted"))
                    }
                    ForEach(runs.prefix(10)) { run in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(run.skipped ? "Skipped" : run.trigger.capitalized)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(run.skipped ? Color("FGMuted") : Color("Moss700"))
                                if let reason = run.skip_reason {
                                    Text(reason).font(.caption).foregroundStyle(Color("FGMuted"))
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(shortDate(run.started_at)).font(.caption.monospacedDigit()).foregroundStyle(Color("FGMuted"))
                                if let d = run.duration_min { Text("\(Int(d)) min").font(.caption.monospacedDigit()).foregroundStyle(Color("FGMuted")) }
                            }
                        }
                        .padding(.vertical, 4)
                        if run.id != runs.prefix(10).last?.id { Divider() }
                    }
                }
                .padding(16)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
            }
            .padding(16)
        }
        .navigationTitle(currentZone.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button { showWaterSheet = true } label: {
                    Label("Water", systemImage: "drop.fill")
                }
                .tint(Color("Moss700"))
            }
        }
        .sheet(isPresented: $showWaterSheet) {
            WaterSheet(zone: currentZone) { duration in
                Task {
                    isWatering = true
                    _ = try? await client.waterZone(currentZone.id, durationMin: duration)
                    isWatering = false
                }
            }
        }
        .sheet(isPresented: $showAddSchedule) {
            AddScheduleSheet(zoneId: currentZone.id) { sched in
                schedules.append(sched)
            }
        }
        .task { await load() }
        .onChange(of: historyHours) { _, _ in Task { await loadHistory() } }
        .refreshable { await load() }
    }

    private var moistureLabel: String {
        guard let m = latestMoisture else { return "No data" }
        if m < 40 { return "Needs water" }
        if m > 75 { return "Well watered" }
        return "Comfortable"
    }

    private var moistureTone: StatTile.Tone {
        guard let m = latestMoisture else { return .neutral }
        if m < 40 { return .warn }
        if m > 75 { return .info }
        return .good
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        async let h = try? client.moistureHistory(zoneId: zone.id, hours: historyHours)
        async let r = try? client.runHistory(zoneId: zone.id)
        async let s = try? client.schedules(zoneId: zone.id)
        async let p = try? client.profiles()
        async let z = try? client.zone(zone.id)
        let (fetchedH, fetchedR, fetchedS, fetchedP, fetchedZ) = await (h, r, s, p, z)
        history   = fetchedH ?? []
        runs      = fetchedR ?? []
        schedules = fetchedS ?? []
        profiles  = fetchedP ?? []
        if let z = fetchedZ { currentZone = z }
    }

    private func loadHistory() async {
        history = (try? await client.moistureHistory(zoneId: zone.id, hours: historyHours)) ?? []
    }

    private func assignProfile(_ profileId: String) {
        Task {
            if let updated = try? await client.assignProfile(zoneId: currentZone.id, profileId: profileId) {
                currentZone = updated
            }
        }
    }

    private func toggleSchedule(_ sched: Schedule) {
        Task {
            let updated = try? await client.updateSchedule(sched.id, body: ScheduleUpdate(enabled: !sched.enabled, days_of_week: nil, time_local: nil, duration_min: nil, smart: nil))
            if let u = updated, let idx = schedules.firstIndex(where: { $0.id == u.id }) {
                schedules[idx] = u
            }
        }
    }

    private func deleteSchedule(_ sched: Schedule) {
        Task {
            try? await client.deleteSchedule(sched.id)
            schedules.removeAll { $0.id == sched.id }
        }
    }

    private func dayNames(_ days: [Int]) -> String {
        let names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
        return days.compactMap { names[safe: $0 - 1] }.joined(separator: ", ")
    }

    private func shortDate(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fmt.date(from: iso) ?? Date()
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }
}

// MARK: - Water sheet

struct WaterSheet: View {
    @Environment(\.dismiss) var dismiss
    let zone: Zone
    let onConfirm: (Double) -> Void
    @State private var duration: Double

    init(zone: Zone, onConfirm: @escaping (Double) -> Void) {
        self.zone = zone
        self.onConfirm = onConfirm
        _duration = State(initialValue: zone.active_profile?.default_run_min ?? 5)
    }

    var maxMin: Double { zone.active_profile?.max_run_min ?? 15 }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Choose duration")
                    .font(.headline)
                    .foregroundStyle(Color("FGMuted"))

                Text("\(Int(duration)) min")
                    .font(.system(size: 56, weight: .thin, design: .monospaced))
                    .foregroundStyle(Color("Moss700"))

                Slider(value: $duration, in: 1...maxMin, step: 1)
                    .tint(Color("Moss700"))
                    .padding(.horizontal)

                Text("Max allowed: \(Int(maxMin)) min")
                    .font(.caption)
                    .foregroundStyle(Color("FGMuted"))

                Button("Start watering") {
                    onConfirm(duration)
                    dismiss()
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color("Moss700"), in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.white)
                .font(.headline)
                .padding(.horizontal)

                Spacer()
            }
            .padding(.top, 32)
            .navigationTitle("Water now")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Add schedule sheet

struct AddScheduleSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var client: SierraClient
    let zoneId: String
    let onCreated: (Schedule) -> Void

    @State private var days: Set<Int> = [1, 3, 5]
    @State private var time = Date()
    @State private var duration: Double = 10
    @State private var smart = true
    @State private var isSaving = false

    private let dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Days") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 8) {
                        ForEach(1...7, id: \.self) { d in
                            Button(dayNames[d - 1]) {
                                if days.contains(d) { days.remove(d) } else { days.insert(d) }
                            }
                            .font(.caption.weight(days.contains(d) ? .bold : .regular))
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(days.contains(d) ? Color("Moss700") : Color("BGSunken"), in: RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(days.contains(d) ? .white : Color("FG"))
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section("Time & duration") {
                    DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                    Stepper("Duration: \(Int(duration)) min", value: $duration, in: 1...60)
                }
                Section {
                    Toggle("Smart scheduling", isOn: $smart)
                        .tint(Color("Moss700"))
                }
            }
            .navigationTitle("Add schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(days.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        let cal = Calendar.current
        let h = cal.component(.hour, from: time)
        let m = cal.component(.minute, from: time)
        let timeStr = String(format: "%02d:%02d", h, m)
        isSaving = true
        Task {
            let body = ScheduleCreate(zone_id: zoneId, days_of_week: days.sorted(), time_local: timeStr, duration_min: duration, smart: smart, enabled: true)
            if let sched = try? await client.createSchedule(body) {
                onCreated(sched)
                dismiss()
            }
            isSaving = false
        }
    }
}
