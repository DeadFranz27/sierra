import Foundation

enum SierraError: LocalizedError {
    case badURL, unauthorized, serverError(String), decodingError

    var errorDescription: String? {
        switch self {
        case .badURL:             return "Invalid server URL"
        case .unauthorized:       return "Wrong username or password"
        case .serverError(let m): return m
        case .decodingError:      return "Unexpected response from server"
        }
    }
}

@MainActor
final class SierraClient: ObservableObject, @unchecked Sendable {
    let baseURL: String
    private let username: String
    private let password: String
    private let session: URLSession

    init(baseURL: String, username: String, password: String) {
        // Normalise — strip trailing slash, ensure http/https prefix
        var url = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if !url.hasPrefix("http://") && !url.hasPrefix("https://") {
            url = "http://" + url
        }
        self.baseURL = url.hasSuffix("/") ? String(url.dropLast()) : url
        self.username = username
        self.password = password
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage()
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        self.session = URLSession(configuration: config)
    }

    // MARK: - Auth

    func login() async throws {
        struct Body: Encodable { let username, password: String }
        _ = try await post("/api/auth/login", body: Body(username: username, password: password), response: AnyCodable.self)
    }

    func logout() async throws {
        _ = try? await post("/api/auth/logout", body: EmptyBody(), response: AnyCodable.self)
    }

    // MARK: - Zones

    func zones() async throws -> [Zone] {
        try await get("/api/zones")
    }

    func zone(_ id: String) async throws -> Zone {
        try await get("/api/zones/\(id)")
    }

    func createZone(_ body: ZoneCreate) async throws -> Zone {
        try await post("/api/zones", body: body, response: Zone.self)
    }

    func updateZone(_ id: String, body: ZoneUpdate) async throws -> Zone {
        try await patch("/api/zones/\(id)", body: body, response: Zone.self)
    }

    func deleteZone(_ id: String) async throws {
        try await delete("/api/zones/\(id)")
    }

    func assignProfile(zoneId: String, profileId: String) async throws -> Zone {
        try await post("/api/zones/\(zoneId)/profile", body: AssignProfileRequest(profile_id: profileId), response: Zone.self)
    }

    func setGrowthStage(zoneId: String, stage: String) async throws -> Zone {
        try await patch("/api/zones/\(zoneId)/growth-stage", body: GrowthStageUpdate(growth_stage: stage), response: Zone.self)
    }

    func waterZone(_ id: String, durationMin: Double?) async throws -> Run {
        try await post("/api/zones/\(id)/water", body: WaterRequest(duration_min: durationMin), response: Run.self)
    }

    func skipNext(_ id: String) async throws {
        try await delete("/api/zones/\(id)/skip-next")   // POST with no body
        _ = try? await postEmpty("/api/zones/\(id)/skip-next")
    }

    func moistureHistory(zoneId: String, hours: Int = 24) async throws -> [MoistureReading] {
        try await get("/api/zones/\(zoneId)/history?hours=\(hours)")
    }

    func runHistory(zoneId: String) async throws -> [Run] {
        try await get("/api/zones/\(zoneId)/runs")
    }

    // MARK: - Profiles

    func profiles() async throws -> [PlantProfile] {
        try await get("/api/profiles")
    }

    func createProfile(_ body: ProfileCreate) async throws -> PlantProfile {
        try await post("/api/profiles", body: body, response: PlantProfile.self)
    }

    func updateProfile(_ id: String, body: ProfileCreate) async throws -> PlantProfile {
        try await put("/api/profiles/\(id)", body: body, response: PlantProfile.self)
    }

    func deleteProfile(_ id: String) async throws {
        try await delete("/api/profiles/\(id)")
    }

    // MARK: - Schedules

    func schedules(zoneId: String? = nil) async throws -> [Schedule] {
        let path = zoneId.map { "/api/schedules?zone_id=\($0)" } ?? "/api/schedules"
        return try await get(path)
    }

    func createSchedule(_ body: ScheduleCreate) async throws -> Schedule {
        try await post("/api/schedules", body: body, response: Schedule.self)
    }

    func updateSchedule(_ id: String, body: ScheduleUpdate) async throws -> Schedule {
        try await patch("/api/schedules/\(id)", body: body, response: Schedule.self)
    }

    func deleteSchedule(_ id: String) async throws {
        try await delete("/api/schedules/\(id)")
    }

    // MARK: - Device

    func devices() async throws -> [Device] {
        try await get("/api/device/status")
    }

    // MARK: - Settings

    func getLocation() async throws -> HubLocation? {
        try? await get("/api/settings/location")
    }

    func setLocation(_ loc: HubLocation) async throws -> HubLocation {
        try await put("/api/settings/location", body: loc, response: HubLocation.self)
    }

    // MARK: - Open-Meteo geocoding (no auth needed)

    func searchGeo(query: String) async throws -> [GeoResult] {
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://geocoding-api.open-meteo.com/v1/search?name=\(encoded)&count=5&language=en&format=json")
        else { return [] }
        let (data, _) = try await URLSession.shared.data(from: url)
        let resp = try JSONDecoder().decode(GeoSearchResponse.self, from: data)
        return resp.results ?? []
    }

    func fetchWeather(lat: Double, lon: Double, hours: Int) async throws -> [WeatherPoint] {
        let days = hours <= 24 ? 1 : 7
        guard let url = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(lat)&longitude=\(lon)&hourly=precipitation,wind_speed_10m&forecast_days=\(days)&past_days=\(days)&timezone=auto") else { return [] }
        let (data, _) = try await URLSession.shared.data(from: url)
        let json = try JSONDecoder().decode(OpenMeteoResponse.self, from: data)
        let now = Date()
        let cutoff = now.addingTimeInterval(-Double(hours) * 3600)
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let fmtNoTZ = DateFormatter()
        fmtNoTZ.dateFormat = "yyyy-MM-dd'T'HH:mm"

        var points: [WeatherPoint] = []
        for i in json.hourly.time.indices {
            let raw = json.hourly.time[i]
            let ts = fmt.date(from: raw) ?? fmtNoTZ.date(from: raw) ?? Date.distantPast
            guard ts >= cutoff && ts <= now else { continue }
            let label = hours <= 24
                ? ts.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
                : ts.formatted(.dateTime.weekday(.abbreviated).day())
            points.append(WeatherPoint(
                label: label,
                timestamp: ts,
                rain: json.hourly.precipitation[safe: i] ?? 0,
                wind: json.hourly.wind_speed_10m[safe: i] ?? 0
            ))
        }

        guard hours > 24 else { return points }
        // Aggregate by day label
        var byDay: [String: (label: String, rain: Double, windSum: Double, count: Int)] = [:]
        for p in points {
            var entry = byDay[p.label] ?? (p.label, 0, 0, 0)
            entry.rain += p.rain
            entry.windSum += p.wind
            entry.count += 1
            byDay[p.label] = entry
        }
        return byDay.values.map {
            WeatherPoint(label: $0.label, timestamp: Date(), rain: $0.rain, wind: $0.windSum / Double(max($0.count, 1)))
        }.sorted { $0.label < $1.label }
    }

    // MARK: - HTTP helpers

    private func url(_ path: String) throws -> URL {
        guard let url = URL(string: baseURL + path) else { throw SierraError.badURL }
        return url
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        var req = URLRequest(url: try url(path))
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await perform(req)
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, body: B, response: T.Type) async throws -> T {
        var req = URLRequest(url: try url(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await perform(req)
    }

    private func postEmpty(_ path: String) async throws {
        var req = URLRequest(url: try url(path))
        req.httpMethod = "POST"
        let (_, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return }
    }

    private func put<B: Encodable, T: Decodable>(_ path: String, body: B, response: T.Type) async throws -> T {
        var req = URLRequest(url: try url(path))
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await perform(req)
    }

    private func patch<B: Encodable, T: Decodable>(_ path: String, body: B, response: T.Type) async throws -> T {
        var req = URLRequest(url: try url(path))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await perform(req)
    }

    private func delete(_ path: String) async throws {
        var req = URLRequest(url: try url(path))
        req.httpMethod = "DELETE"
        let (_, resp) = try await session.data(for: req)
        if let http = resp as? HTTPURLResponse, http.statusCode == 401 { throw SierraError.unauthorized }
    }

    private func perform<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw SierraError.serverError("No response") }
        if http.statusCode == 401 { throw SierraError.unauthorized }
        if !(200..<300).contains(http.statusCode) {
            let msg = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw SierraError.serverError(msg)
        }
        if data.isEmpty, let empty = EmptyResponse() as? T { return empty }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw SierraError.decodingError }
    }
}

// MARK: - Helpers

private struct EmptyBody: Encodable {}
private struct AnyCodable: Codable {}
private struct EmptyResponse {}

private struct OpenMeteoResponse: Decodable {
    struct Hourly: Decodable {
        let time: [String]
        let precipitation: [Double]
        let wind_speed_10m: [Double]
    }
    let hourly: Hourly
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
