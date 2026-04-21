import SwiftUI

@main
struct SierraClientApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}

// MARK: - Session store

@MainActor
final class SessionStore: ObservableObject {
    @Published var isConnected = false
    @Published var client: SierraClient?

    init() {
        if let saved = Keychain.loadServer() {
            let c = SierraClient(baseURL: saved.url, username: saved.username, password: saved.password)
            client = c
            Task { await tryRestore(c) }
        }
    }

    private func tryRestore(_ c: SierraClient) async {
        do {
            try await c.login()
            isConnected = true
        } catch {
            isConnected = false
        }
    }

    func connect(url: String, username: String, password: String) async throws {
        let c = SierraClient(baseURL: url, username: username, password: password)
        try await c.login()
        Keychain.saveServer(.init(url: url, username: username, password: password))
        client = c
        isConnected = true
    }

    func disconnect() {
        Task { try? await client?.logout() }
        Keychain.deleteServer()
        client = nil
        isConnected = false
    }
}

// MARK: - Root routing

struct RootView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        if session.isConnected, let client = session.client {
            MainTabView()
                .environmentObject(client)
        } else {
            ConnectView()
        }
    }
}

// MARK: - Main tab / split view

struct MainTabView: View {
    @EnvironmentObject var client: SierraClient
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        if sizeClass == .regular {
            // iPad — NavigationSplitView
            NavigationSplitView {
                SidebarView()
            } detail: {
                DashboardView()
            }
        } else {
            // iPhone — TabView with iOS 26 tab bar
            TabView {
                Tab("Dashboard", systemImage: "leaf.fill") { DashboardView() }
                Tab("Zones", systemImage: "drop.fill") { ZonesView() }
                Tab("Schedule", systemImage: "calendar") { SchedulesView() }
                Tab("Library", systemImage: "books.vertical.fill") { ProfilesView() }
                Tab("Device", systemImage: "cpu") { DeviceView() }
            }
            .tint(Color("Moss700"))
        }
    }
}

struct SidebarView: View {
    @EnvironmentObject var session: SessionStore
    @State private var selection: SidebarItem? = .dashboard

    enum SidebarItem: String, CaseIterable, Identifiable {
        case dashboard, zones, schedule, library, device, settings
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
        var icon: String {
            switch self {
            case .dashboard: return "leaf.fill"
            case .zones:     return "drop.fill"
            case .schedule:  return "calendar"
            case .library:   return "books.vertical.fill"
            case .device:    return "cpu"
            case .settings:  return "gearshape.fill"
            }
        }
    }

    var body: some View {
        List(SidebarItem.allCases, selection: $selection) { item in
            NavigationLink(value: item) {
                Label(item.label, systemImage: item.icon)
            }
        }
        .navigationTitle("Sierra")
        .navigationDestination(for: SidebarItem.self) { item in
            switch item {
            case .dashboard: DashboardView()
            case .zones:     ZonesView()
            case .schedule:  SchedulesView()
            case .library:   ProfilesView()
            case .device:    DeviceView()
            case .settings:  SettingsView()
            }
        }
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                Button("Disconnect", role: .destructive) { session.disconnect() }
                    .foregroundStyle(.red)
            }
        }
    }
}
