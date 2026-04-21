import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var session: SessionStore

    @State private var serverURL = ""
    @State private var username = ""
    @State private var password = ""
    @State private var isReconnecting = false
    @State private var error: String?
    @State private var showConfirmDisconnect = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    LabeledContent("URL", value: session.client?.baseURL ?? "—")
                }

                Section("Debug") {
                    NavigationLink("Installed fonts") { FontDebugView() }
                }

                Section("Re-connect to different server") {
                    TextField("Server URL", text: $serverURL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    TextField("Username", text: $username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    SecureField("Password", text: $password)
                }

                if let err = error {
                    Section {
                        Text(err).foregroundStyle(.red).font(.footnote)
                    }
                }

                Section {
                    Button("Connect") { reconnect() }
                        .disabled(serverURL.isEmpty || username.isEmpty || password.isEmpty || isReconnecting)
                        .foregroundStyle(Color("Moss700"))
                }

                Section {
                    Button(role: .destructive) {
                        showConfirmDisconnect = true
                    } label: {
                        Label("Disconnect", systemImage: "eject.fill")
                    }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Disconnect from Sierra?", isPresented: $showConfirmDisconnect, titleVisibility: .visible) {
                Button("Disconnect", role: .destructive) { session.disconnect() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to re-enter the server address and credentials.")
            }
        }
    }

    private func reconnect() {
        isReconnecting = true
        error = nil
        Task {
            do {
                try await session.connect(url: serverURL, username: username, password: password)
            } catch {
                self.error = error.localizedDescription
            }
            isReconnecting = false
        }
    }
}
