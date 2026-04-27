import Foundation

// MARK: - Zone (matches backend ZoneOut)

struct Zone: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var area_m2: Double?
    let valve_device_id: String
    let sensor_device_id: String
    var active_profile_id: String?
    var active_profile: ProfileSummary?
    var growth_stage: String
    var profile_assigned_at: String?
    var is_calibrated: Bool?
    var calibration_dry_raw: Double?
    var calibration_wet_raw: Double?
    var calibrated_at: String?
}

// MARK: - PlantProfile (matches backend PlantProfileOut)

struct PlantProfile: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var description: String
    var is_preset: Bool
    var preset_key: String?
    var category: String?
    var moisture_dry: Double
    var moisture_target: Double
    var moisture_wet: Double
    var default_run_min: Double
    var max_run_min: Double
    var min_interval_hours: Double
    var sun_preference: String
    var season_active: [Int]
    var created_at: String?
    var forked_from_id: String?
}

// Embedded summary returned inside ZoneOut (NOT a full PlantProfile)
struct ProfileSummary: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var description: String
    var moisture_dry: Double
    var moisture_target: Double
    var moisture_wet: Double
    var default_run_min: Double
    var max_run_min: Double
    var is_preset: Bool
}

// MARK: - Schedule (matches ScheduleOut)

struct Schedule: Codable, Identifiable, Sendable {
    let id: String
    let zone_id: String
    var days_of_week: [Int]
    var time_local: String
    var duration_min: Double
    var smart: Bool
    var enabled: Bool
}

// MARK: - MoistureReading (matches MoistureReadingOut — NO id, NO zone_id)

struct MoistureReading: Codable, Identifiable, Sendable {
    var timestamp: String
    var value_percent: Double
    var temp_c: Double?

    // Synthesized from timestamp so SwiftUI lists are happy.
    var id: String { timestamp }

    enum CodingKeys: String, CodingKey {
        case timestamp, value_percent, temp_c
    }
}

// MARK: - Run (matches RunOut — NO zone_id, NO profile/growth fields)

struct Run: Codable, Identifiable, Sendable {
    let id: String
    let started_at: String
    let ended_at: String?
    let duration_min: Double?
    let trigger: String
    let moisture_before: Double?
    let moisture_after: Double?
    let skipped: Bool
    let skip_reason: String?
    let valve_fault_detected: Bool?
}

// MARK: - Device (matches DeviceOut)

enum DeviceStatus: String, Codable, Sendable {
    case online, offline, degraded, error

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = DeviceStatus(rawValue: raw) ?? .offline
    }
}

struct Device: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let name: String
    let status: DeviceStatus
    let firmware_version: String
    let actuator_type: String?
    let mac: String?
    let last_seen: String?
    let wifi_rssi: Double?
    let ip_address: String?
    let valve_state: String?
    let water_level: Bool?
    let error_flag: Bool?
    let error_message: String?
    let paired_at: String?
    let pairing_method: String?
    let pending_unpair: Bool?

    enum CodingKeys: String, CodingKey {
        case id, kind, name, status, firmware_version, actuator_type, mac
        case last_seen, wifi_rssi, ip_address, valve_state, water_level
        case error_flag, error_message, paired_at, pairing_method, pending_unpair
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = try c.decode(String.self, forKey: .kind)
        name = try c.decode(String.self, forKey: .name)
        status = try c.decodeIfPresent(DeviceStatus.self, forKey: .status) ?? .offline
        firmware_version = try c.decodeIfPresent(String.self, forKey: .firmware_version) ?? "—"
        actuator_type = try c.decodeIfPresent(String.self, forKey: .actuator_type)
        mac = try c.decodeIfPresent(String.self, forKey: .mac)
        last_seen = try c.decodeIfPresent(String.self, forKey: .last_seen)
        wifi_rssi = try c.decodeIfPresent(Double.self, forKey: .wifi_rssi)
        ip_address = try c.decodeIfPresent(String.self, forKey: .ip_address)
        valve_state = try c.decodeIfPresent(String.self, forKey: .valve_state)
        water_level = try c.decodeIfPresent(Bool.self, forKey: .water_level)
        error_flag = try c.decodeIfPresent(Bool.self, forKey: .error_flag)
        error_message = try c.decodeIfPresent(String.self, forKey: .error_message)
        paired_at = try c.decodeIfPresent(String.self, forKey: .paired_at)
        pairing_method = try c.decodeIfPresent(String.self, forKey: .pairing_method)
        pending_unpair = try c.decodeIfPresent(Bool.self, forKey: .pending_unpair)
    }

    init(id: String, kind: String, name: String, firmware_version: String,
         last_seen: String?, wifi_rssi: Double?, valve_state: String?,
         status: DeviceStatus = .offline) {
        self.id = id
        self.kind = kind
        self.name = name
        self.status = status
        self.firmware_version = firmware_version
        self.actuator_type = nil
        self.mac = nil
        self.last_seen = last_seen
        self.wifi_rssi = wifi_rssi
        self.ip_address = nil
        self.valve_state = valve_state
        self.water_level = nil
        self.error_flag = nil
        self.error_message = nil
        self.paired_at = nil
        self.pairing_method = nil
        self.pending_unpair = nil
    }
}

// MARK: - HubLocation (matches LocationOut on read; LocationIn on write)

struct HubLocation: Codable, Sendable {
    var label: String
    var latitude: Double
    var longitude: Double
    var timezone: String?  // present in LocationOut, absent in LocationIn — accepted both ways

    init(label: String, latitude: Double, longitude: Double, timezone: String? = nil) {
        self.label = label
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = timezone
    }
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
    let area_m2: Double?
    // growth_stage is updated via its own dedicated PATCH endpoint;
    // ZoneUpdate only accepts name + area.
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
    let max_run_min: Double
    let min_interval_hours: Double
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

// MARK: - Device update / pairing

struct DeviceUpdate: Encodable {
    let name: String?
    let error_flag: Bool?
    let error_message: String?
}

struct DeviceCandidate: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let mac: String
    let ip: String
    let port: Int?
    let hostname: String?
    let firmware_version: String
    let announced_at: String
    let last_seen_at: String
    let claimed_at: String?
    let expires_at: String
}

struct PairRequest: Encodable {
    let pairing_code: String?
    let device_id: String?
    let ip: String?
}

struct PairResponse: Codable, Sendable {
    let device: Device
    let message: String
}

// MARK: - Auth

struct AuthStatus: Codable, Sendable {
    let has_users: Bool
}

struct SetupRequest: Encodable {
    let username: String
    let password: String
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

// MARK: - Onboarding wizard

struct WizardSnapshot: Codable, Sendable, Equatable {
    var zone_name: String?
    var profile_id: String?
    var location_label: String?
    var location_lat: Double?
    var location_lon: Double?
}

struct OnboardingProgress: Codable, Sendable {
    let id: String
    let current_step: Int
    let state_snapshot: WizardSnapshot?
    let started_at: String
    let completed_at: String?
    let is_complete: Bool?
}

struct OnboardingProgressUpdate: Encodable {
    let current_step: Int
    let state_snapshot: WizardSnapshot?
}

// MARK: - Open-Meteo weather

struct WeatherPoint: Identifiable {
    let id = UUID()
    let label: String
    let timestamp: Date
    let rain: Double
    let wind: Double
    var temperatureC: Double? = nil
    var weatherCode: Int? = nil
    var isDay: Bool? = nil
}
