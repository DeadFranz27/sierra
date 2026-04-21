import SwiftUI

struct SchedulesView: View {
    @EnvironmentObject var client: SierraClient
    @State private var schedules: [(schedule: Schedule, zoneName: String)] = []
    @State private var zones: [Zone] = []
    @State private var isLoading = true
    @State private var showAdd = false

    private let dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading schedules…")
                } else if schedules.isEmpty {
                    ContentUnavailableView {
                        Label("No schedules", systemImage: "calendar.badge.plus")
                    } description: {
                        Text("Add a schedule to automate watering.")
                    } actions: {
                        Button("Add Schedule") { showAdd = true }
                            .buttonStyle(.borderedProminent).tint(Color("Moss700"))
                    }
                } else {
                    List {
                        // Weekly grid
                        Section("Week view") {
                            WeekGridView(schedules: schedules.map(\.schedule), zones: zones)
                                .frame(height: 140)
                                .listRowInsets(.init())
                        }

                        // List
                        Section("All schedules") {
                            ForEach(schedules, id: \.schedule.id) { item in
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(item.zoneName)
                                            .font(.subheadline.weight(.semibold))
                                        Text(item.schedule.days_of_week.compactMap { dayNames[safe: $0 - 1] }.joined(separator: ", ") + " · " + item.schedule.time_local)
                                            .font(.caption)
                                            .foregroundStyle(Color("FGMuted"))
                                    }
                                    Spacer()
                                    Text("\(Int(item.schedule.duration_min)) min")
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(Color("FGMuted"))
                                    if item.schedule.smart {
                                        Image(systemName: "wand.and.stars")
                                            .font(.caption)
                                            .foregroundStyle(Color("Moss700"))
                                    }
                                    Toggle("", isOn: Binding(
                                        get: { item.schedule.enabled },
                                        set: { _ in toggle(item.schedule) }
                                    ))
                                    .labelsHidden()
                                    .tint(Color("Moss700"))
                                }
                                .opacity(item.schedule.enabled ? 1 : 0.4)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) { delete(item.schedule) } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAdd) {
                GlobalAddScheduleSheet(zones: zones) { newSched in
                    let zoneName = zones.first { $0.id == newSched.zone_id }?.name ?? "Unknown"
                    schedules.append((newSched, zoneName))
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
        let allScheds = (try? await client.schedules()) ?? []
        let zMap = Dictionary(uniqueKeysWithValues: zones.map { ($0.id, $0.name) })
        schedules = allScheds.map { ($0, zMap[$0.zone_id] ?? "Unknown") }
    }

    private func toggle(_ sched: Schedule) {
        Task {
            let updated = try? await client.updateSchedule(sched.id, body: ScheduleUpdate(enabled: !sched.enabled, days_of_week: nil, time_local: nil, duration_min: nil, smart: nil))
            if let u = updated, let idx = schedules.firstIndex(where: { $0.schedule.id == u.id }) {
                schedules[idx].schedule = u
            }
        }
    }

    private func delete(_ sched: Schedule) {
        Task {
            try? await client.deleteSchedule(sched.id)
            schedules.removeAll { $0.schedule.id == sched.id }
        }
    }
}

// MARK: - Simple week grid

struct WeekGridView: View {
    let schedules: [Schedule]
    let zones: [Zone]
    private let days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

    var body: some View {
        HStack(spacing: 1) {
            ForEach(0..<7, id: \.self) { di in
                VStack(spacing: 4) {
                    Text(days[di])
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color("FGMuted"))
                    VStack(spacing: 2) {
                        ForEach(schedules.filter { $0.days_of_week.contains(di + 1) && $0.enabled }) { s in
                            let zoneName = zones.first { $0.id == s.zone_id }?.name ?? ""
                            Text(zoneName.prefix(4))
                                .font(.system(size: 8, weight: .medium))
                                .padding(.horizontal, 3).padding(.vertical, 2)
                                .frame(maxWidth: .infinity)
                                .background(Color("Moss700").opacity(0.8), in: RoundedRectangle(cornerRadius: 3))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color("BGSunken"), in: RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(12)
    }
}

// MARK: - Global add schedule sheet

struct GlobalAddScheduleSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var client: SierraClient
    let zones: [Zone]
    let onCreated: (Schedule) -> Void

    @State private var selectedZoneId: String = ""
    @State private var days: Set<Int> = [1, 3, 5]
    @State private var time = Date()
    @State private var duration: Double = 10
    @State private var smart = true
    @State private var isSaving = false

    private let dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Zone") {
                    Picker("Zone", selection: $selectedZoneId) {
                        ForEach(zones) { z in Text(z.name).tag(z.id) }
                    }
                }
                Section("Days") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 6) {
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
                    Toggle("Smart scheduling", isOn: $smart).tint(Color("Moss700"))
                }
            }
            .navigationTitle("Add schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(selectedZoneId.isEmpty || days.isEmpty || isSaving)
                }
            }
            .onAppear { selectedZoneId = zones.first?.id ?? "" }
        }
    }

    private func save() {
        let cal = Calendar.current
        let h = cal.component(.hour, from: time)
        let m = cal.component(.minute, from: time)
        let timeStr = String(format: "%02d:%02d", h, m)
        isSaving = true
        Task {
            let body = ScheduleCreate(zone_id: selectedZoneId, days_of_week: days.sorted(), time_local: timeStr, duration_min: duration, smart: smart, enabled: true)
            if let sched = try? await client.createSchedule(body) {
                onCreated(sched)
                dismiss()
            }
            isSaving = false
        }
    }
}
