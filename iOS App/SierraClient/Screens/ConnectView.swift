import SwiftUI

struct ConnectView: View {
    @EnvironmentObject var session: SessionStore
    @State private var serverURL = ""
    @State private var username = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var focused: Field?

    enum Field { case url, username, password }

    var body: some View {
        ZStack {
            Color("BG").ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "leaf.fill")
                            .font(.system(size: 52, weight: .light))
                            .foregroundStyle(Color("Moss700"))
                            .padding(.bottom, 4)
                        Text("Sierra")
                            .font(.display(44))
                            .foregroundStyle(Color("Moss700"))
                        Text("Smart irrigation · local only")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color("FGMuted"))
                            .tracking(1)
                            .textCase(.uppercase)
                    }
                    .padding(.top, 72)
                    .padding(.bottom, 48)

                    // Card
                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Server", systemImage: "network")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color("FGMuted"))
                                .textCase(.uppercase)
                                .tracking(0.8)
                            TextField("192.168.1.100 or sierra.local", text: $serverURL)
                                .textFieldStyle(.plain)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .focused($focused, equals: .url)
                                .padding(12)
                                .background(Color("BGSunken"), in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused == .url ? Color("Moss700") : Color("Border"), lineWidth: 1))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Label("Username", systemImage: "person")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color("FGMuted"))
                                .textCase(.uppercase)
                                .tracking(0.8)
                            TextField("demo", text: $username)
                                .textFieldStyle(.plain)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .focused($focused, equals: .username)
                                .padding(12)
                                .background(Color("BGSunken"), in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused == .username ? Color("Moss700") : Color("Border"), lineWidth: 1))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Label("Password", systemImage: "lock")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color("FGMuted"))
                                .textCase(.uppercase)
                                .tracking(0.8)
                            SecureField("••••••••", text: $password)
                                .textFieldStyle(.plain)
                                .focused($focused, equals: .password)
                                .padding(12)
                                .background(Color("BGSunken"), in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused == .password ? Color("Moss700") : Color("Border"), lineWidth: 1))
                        }

                        if let err = errorMessage {
                            Label(err, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundStyle(Color("StateBad"))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(action: connect) {
                            Group {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Text("Connect")
                                        .font(.system(size: 16, weight: .semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(.plain)
                        .background(serverURL.isEmpty || username.isEmpty || password.isEmpty || isLoading ? Color("Moss700").opacity(0.4) : Color("Moss700"), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                        .disabled(serverURL.isEmpty || username.isEmpty || password.isEmpty || isLoading)
                    }
                    .padding(24)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                    .padding(.horizontal, 24)

                    // Privacy note
                    HStack(spacing: 6) {
                        Image(systemName: "lock.shield.fill")
                        Text("Connects directly to your Hub — no cloud.")
                    }
                    .font(.caption)
                    .foregroundStyle(Color("FGMuted"))
                    .padding(.top, 20)
                    .padding(.bottom, 48)
                }
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func connect() {
        focused = nil
        errorMessage = nil
        isLoading = true
        Task {
            do {
                try await session.connect(url: serverURL, username: username, password: password)
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

#Preview {
    ConnectView().environmentObject(SessionStore())
}
