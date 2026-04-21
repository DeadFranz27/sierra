import SwiftUI

struct ProfilesView: View {
    @EnvironmentObject var client: SierraClient
    @State private var profiles: [PlantProfile] = []
    @State private var isLoading = true
    @State private var formTarget: FormTarget?

    enum FormTarget: Identifiable {
        case create
        case fork(PlantProfile)
        case edit(PlantProfile)
        var id: String {
            switch self {
            case .create:     return "create"
            case .fork(let p): return "fork-\(p.id)"
            case .edit(let p): return "edit-\(p.id)"
            }
        }
    }

    private var presets: [PlantProfile] { profiles.filter { $0.is_preset } }
    private var custom: [PlantProfile] { profiles.filter { !$0.is_preset } }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading library…")
                } else {
                    List {
                        if !presets.isEmpty {
                            Section("Preset profiles") {
                                ForEach(presets) { p in
                                    ProfileRow(profile: p,
                                               onFork: { formTarget = .fork(p) },
                                               onEdit: nil,
                                               onDelete: nil)
                                }
                            }
                        }
                        if !custom.isEmpty {
                            Section("Custom profiles") {
                                ForEach(custom) { p in
                                    ProfileRow(profile: p,
                                               onFork: { formTarget = .fork(p) },
                                               onEdit: { formTarget = .edit(p) },
                                               onDelete: { deleteProfile(p) })
                                }
                            }
                        }
                        if custom.isEmpty {
                            Section {
                                Text("No custom profiles yet. Fork a preset or create from scratch.")
                                    .font(.footnote).foregroundStyle(Color("FGMuted"))
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Plant Library")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { formTarget = .create } label: { Image(systemName: "plus") }
                }
            }
            .sheet(item: $formTarget) { target in
                ProfileFormSheet(target: target) { saved in
                    Task { await load() }
                }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        isLoading = true
        profiles = (try? await client.profiles()) ?? []
        isLoading = false
    }

    private func deleteProfile(_ p: PlantProfile) {
        Task {
            try? await client.deleteProfile(p.id)
            profiles.removeAll { $0.id == p.id }
        }
    }
}

// MARK: - Profile row

struct ProfileRow: View {
    let profile: PlantProfile
    let onFork: () -> Void
    let onEdit: (() -> Void)?
    let onDelete: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(profile.name).font(.subheadline.weight(.semibold))
                        if profile.is_preset {
                            Text("PRESET").font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color("Moss700").opacity(0.12), in: Capsule())
                                .foregroundStyle(Color("Moss700"))
                        }
                    }
                    if !profile.description.isEmpty {
                        Text(profile.description).font(.caption).foregroundStyle(Color("FGMuted")).lineLimit(2)
                    }
                }
                Spacer()
                HStack(spacing: 6) {
                    if let edit = onEdit {
                        Button(action: edit) { Image(systemName: "pencil") }
                            .buttonStyle(.bordered).tint(Color("Moss700")).controlSize(.mini)
                    }
                    Button(action: onFork) { Image(systemName: "plus.square.on.square") }
                        .buttonStyle(.bordered).tint(Color("Moss700")).controlSize(.mini)
                }
            }
            HStack(spacing: 8) {
                ForEach([("Dry", profile.moisture_dry), ("Target", profile.moisture_target), ("Wet", profile.moisture_wet)], id: \.0) { label, val in
                    VStack(spacing: 1) {
                        Text(label).font(.system(size: 9, weight: .semibold)).foregroundStyle(Color("FGMuted")).textCase(.uppercase)
                        Text("\(Int(val))%").font(.system(size: 16, weight: .light, design: .monospaced)).foregroundStyle(Color("Moss700"))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color("BGSunken"), in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .swipeActions(edge: .trailing) {
            if let del = onDelete {
                Button(role: .destructive, action: del) { Label("Delete", systemImage: "trash") }
            }
        }
    }
}

// MARK: - Profile form sheet

struct ProfileFormSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var client: SierraClient
    let target: ProfilesView.FormTarget
    let onSaved: (PlantProfile) -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var dry: Double = 30
    @State private var targetMoisture: Double = 60
    @State private var wet: Double = 80
    @State private var runMin: Double = 5
    @State private var intervalH: Double = 24
    @State private var maxRun: Double = 15
    @State private var sun = "full"
    @State private var months: Set<Int> = Set(1...12)
    @State private var isSaving = false
    @State private var error: String?

    private let monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    private let sunOptions = ["full","partial","shade"]

    private var title: String {
        switch target {
        case .create:       return "New profile"
        case .fork(let p):  return "Fork: \(p.name)"
        case .edit(let p):  return "Edit: \(p.name)"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Profile name", text: $name)
                    TextField("Description", text: $description, axis: .vertical).lineLimit(2...4)
                }
                Section("Moisture thresholds (%)") {
                    HStack {
                        LabeledContent("Dry") { TextField("", value: $dry, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                        LabeledContent("Target") { TextField("", value: $targetMoisture, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                        LabeledContent("Wet") { TextField("", value: $wet, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                    }
                    // Live bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color("BGSunken")).frame(height: 8)
                            Capsule().fill(Color.orange.opacity(0.6))
                                .frame(width: geo.size.width * CGFloat(max(0, targetMoisture - dry) / 100), height: 8)
                                .offset(x: geo.size.width * CGFloat(dry / 100))
                            Capsule().fill(Color("Moss700").opacity(0.7))
                                .frame(width: geo.size.width * CGFloat(max(0, wet - targetMoisture) / 100), height: 8)
                                .offset(x: geo.size.width * CGFloat(targetMoisture / 100))
                        }
                    }
                    .frame(height: 8)
                    .padding(.vertical, 4)
                }
                Section("Timing") {
                    Stepper("Default run: \(Int(runMin)) min", value: $runMin, in: 1...60)
                    Stepper("Max run: \(Int(maxRun)) min", value: $maxRun, in: 1...30)
                    Stepper("Min interval: \(Int(intervalH)) h", value: $intervalH, in: 1...336)
                }
                Section("Sun preference") {
                    Picker("Sun", selection: $sun) {
                        ForEach(sunOptions, id: \.self) { Text($0.capitalized).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Active months") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 8) {
                        ForEach(1...12, id: \.self) { m in
                            Button(monthNames[m - 1]) {
                                if months.contains(m) { months.remove(m) } else { months.insert(m) }
                            }
                            .font(.caption.weight(months.contains(m) ? .bold : .regular))
                            .frame(maxWidth: .infinity).padding(.vertical, 6)
                            .background(months.contains(m) ? Color("Moss700") : Color("BGSunken"), in: RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(months.contains(m) ? .white : Color("FG"))
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                if let err = error { Section { Text(err).foregroundStyle(.red) } }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(name.isEmpty || isSaving)
                }
            }
            .onAppear { prefill() }
        }
    }

    private func prefill() {
        switch target {
        case .create: break
        case .fork(let p):
            name = "\(p.name) (custom)"
            description = p.description
            dry = p.moisture_dry; targetMoisture = p.moisture_target; wet = p.moisture_wet
            runMin = p.default_run_min; intervalH = p.min_interval_hours; maxRun = p.max_run_min
            sun = p.sun_preference; months = Set(p.season_active)
        case .edit(let p):
            name = p.name; description = p.description
            dry = p.moisture_dry; targetMoisture = p.moisture_target; wet = p.moisture_wet
            runMin = p.default_run_min; intervalH = p.min_interval_hours; maxRun = p.max_run_min
            sun = p.sun_preference; months = Set(p.season_active)
        }
    }

    private func save() {
        isSaving = true
        let body = ProfileCreate(name: name, description: description, is_preset: false,
                                  moisture_dry: dry, moisture_target: targetMoisture, moisture_wet: wet,
                                  default_run_min: runMin, min_interval_hours: intervalH, max_run_min: maxRun,
                                  sun_preference: sun, season_active: months.sorted())
        Task {
            do {
                let saved: PlantProfile
                switch target {
                case .create, .fork:
                    saved = try await client.createProfile(body)
                case .edit(let p):
                    saved = try await client.updateProfile(p.id, body: body)
                }
                onSaved(saved)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isSaving = false
        }
    }
}
