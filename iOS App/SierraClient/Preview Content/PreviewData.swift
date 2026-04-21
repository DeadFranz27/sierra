import Foundation

enum PreviewData {
    static let profile = PlantProfile(
        id: "prof-1",
        name: "Tomatoes",
        description: "Standard tomato care profile",
        is_preset: true,
        moisture_dry: 30,
        moisture_target: 60,
        moisture_wet: 80,
        default_run_min: 8,
        min_interval_hours: 24,
        max_run_min: 15,
        sun_preference: "full",
        season_active: [4, 5, 6, 7, 8, 9]
    )

    static let zone = Zone(
        id: "zone-1",
        name: "Front Lawn",
        area_m2: 12.5,
        valve_device_id: "valve-01",
        sensor_device_id: "sense-01",
        active_profile_id: profile.id,
        growth_stage: "established",
        profile_assigned_at: nil,
        active_profile: profile
    )

    static let schedule = Schedule(
        id: "sched-1",
        zone_id: zone.id,
        days_of_week: [1, 3, 5],
        time_local: "07:00",
        duration_min: 10,
        smart: true,
        enabled: true
    )

    static let moistureReadings: [MoistureReading] = {
        let now = Date()
        return (0..<24).map { i in
            let val = 40.0 + Double(i % 6) * 6.0 + Double.random(in: -3...3)
            let ts = ISO8601DateFormatter().string(from: now.addingTimeInterval(Double(i - 23) * 3600))
            return MoistureReading(id: "r-\(i)", zone_id: zone.id, timestamp: ts, value_percent: val, temp_c: 21.0 + Double.random(in: -2...2))
        }
    }()

    static let hub = Device(
        id: "hub-1",
        kind: "hub",
        name: "Sierra Hub",
        firmware_version: "1.2.3",
        last_seen: ISO8601DateFormatter().string(from: Date()),
        wifi_rssi: -58,
        valve_state: nil
    )

    static let weatherPoints: [WeatherPoint] = (0..<7).map { i in
        WeatherPoint(label: "Day \(i+1)", timestamp: Date().addingTimeInterval(Double(i) * 86400), rain: Double.random(in: 0...8), wind: Double.random(in: 5...35))
    }
}
