import Foundation

// MARK: - Zone

struct Zone: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var area_m2: Double?
    let valve_device_id: String
    let sensor_device_id: String
    var active_profile_id: String?
    var growth_stage: String
    var profile_assigned_at: String?
    var active_profile: PlantProfile?
}

// MARK: - PlantProfile

struct PlantProfile: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var description: String
    var is_preset: Bool
    var moisture_dry: Double
    var moisture_target: Double
    var moisture_wet: Double
    var default_run_min: Double
    var min_interval_hours: Double
    var max_run_min: Double
    var sun_preference: String
    var season_active: [Int]
}

// MARK: - Schedule

struct Schedule: Codable, Identifiable, Sendable {
    let id: String
    let zone_id: String
    var days_of_week: [Int]
    var time_local: String
    var duration_min: Double
    var smart: Bool
    var enabled: Bool
}

// MARK: - MoistureReading

struct MoistureReading: Codable, Identifiable, Sendable {
    let id: String
    let zone_id: String
    let timestamp: String
    let value_percent: Double
    let temp_c: Double?
}

// MARK: - Run

struct Run: Codable, Identifiable, Sendable {
    let id: String
    let zone_id: String
    let started_at: String
    let ended_at: String?
    let duration_min: Double?
    let trigger: String
    let profile_id_at_run: String?
    let growth_stage_at_run: String?
    let moisture_before: Double?
    let moisture_after: Double?
    let skipped: Bool
    let skip_reason: String?
}

// MARK: - Device

struct Device: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let name: String
    let firmware_version: String
    let last_seen: String?
    let wifi_rssi: Double?
    let valve_state: String?
}

// MARK: - HubLocation

struct HubLocation: Codable, Sendable {
    var label: String
    var latitude: Double
    var longitude: Double
}

// MARK: - Create/update payloads

struct ZoneCreate: Encodable {
    let name: String
    let valve_device_id: String
    let sensor_device_id: String
    let area_m2: Double?
}

struct ZoneUpdate: Encodable {
    let name: String?
    let growth_stage: String?
    let area_m2: Double?
}

struct ScheduleCreate: Encodable {
    let zone_id: String
    let days_of_week: [Int]
    let time_local: String
    let duration_min: Double
    let smart: Bool
    let enabled: Bool
}

struct ScheduleUpdate: Encodable {
    let enabled: Bool?
    let days_of_week: [Int]?
    let time_local: String?
    let duration_min: Double?
    let smart: Bool?
}

struct ProfileCreate: Encodable {
    let name: String
    let description: String
    let is_preset: Bool
    let moisture_dry: Double
    let moisture_target: Double
    let moisture_wet: Double
    let default_run_min: Double
    let min_interval_hours: Double
    let max_run_min: Double
    let sun_preference: String
    let season_active: [Int]
}

struct WaterRequest: Encodable {
    let duration_min: Double?
}

struct AssignProfileRequest: Encodable {
    let profile_id: String
}

struct GrowthStageUpdate: Encodable {
    let growth_stage: String
}

// MARK: - Open-Meteo geo result

struct GeoResult: Codable, Identifiable {
    let id: Int
    let name: String
    let latitude: Double
    let longitude: Double
    let country: String?
    let admin1: String?

    var displayLabel: String {
        [name, admin1, country].compactMap { $0 }.joined(separator: ", ")
    }
}

struct GeoSearchResponse: Codable {
    let results: [GeoResult]?
}

// MARK: - Open-Meteo weather

struct WeatherPoint: Identifiable {
    let id = UUID()
    let label: String
    let timestamp: Date
    let rain: Double
    let wind: Double
}
