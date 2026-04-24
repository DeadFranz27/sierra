export type Zone = {
  id: string
  name: string
  area_m2: number | null
  valve_device_id: string
  sensor_device_id: string
  active_profile_id: string | null
  growth_stage: string
  profile_assigned_at: string | null
  active_profile: PlantProfile | null
}

export type PlantProfile = {
  id: string
  name: string
  description: string
  is_preset: boolean
  category: string | null
  preset_key: string | null
  moisture_dry: number
  moisture_target: number
  moisture_wet: number
  default_run_min: number
  min_interval_hours: number
  max_run_min: number
  sun_preference: string
  season_active: number[]
}

export type Schedule = {
  id: string
  zone_id: string
  days_of_week: number[]
  time_local: string
  duration_min: number
  smart: boolean
  enabled: boolean
}

export type MoistureReading = {
  id: string
  zone_id: string
  timestamp: string
  value_percent: number
  temp_c: number | null
}

export type Run = {
  id: string
  zone_id: string
  started_at: string
  ended_at: string | null
  duration_min: number | null
  trigger: string
  profile_id_at_run: string | null
  growth_stage_at_run: string | null
  moisture_before: number | null
  moisture_after: number | null
  skipped: boolean
  skip_reason: string | null
}

export type Device = {
  id: string
  kind: 'hub' | 'sense' | 'valve'
  name: string
  status: 'online' | 'offline' | 'degraded' | 'error'
  firmware_version: string | null
  last_seen: string | null
  wifi_rssi: number | null
  ip_address: string | null
  mac: string | null
  actuator_type: string | null
  valve_state: string | null
  water_level: boolean | null
  error_flag: boolean
  error_message: string | null
  mqtt_username: string | null
  paired_at: string | null
}

export type DeviceCandidate = {
  id: string
  kind: 'sense' | 'valve'
  mac: string
  ip: string
  port: number | null
  hostname: string | null
  firmware_version: string | null
  announced_at: string
  last_seen_at: string
  claimed_at: string | null
  expires_at: string
}

export type Alert = {
  id: string
  zone_id: string | null
  device_id: string | null
  kind: string
  severity: 'info' | 'warning' | 'error'
  message: string
  triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

export type HubLocation = {
  label: string
  latitude: number
  longitude: number
}

export type OnboardingProgress = {
  id: string
  current_step: number
  state_snapshot: Record<string, unknown> | null
  started_at: string
  completed_at: string | null
  is_complete: boolean
}

export type MockState = {
  moisture: number
  valve: string
  weather: {
    condition: string
    rain_forecast_mm: number
    temp_c: number
  }
  time_scale: number
  scenario: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (res.status === 401) {
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export type AuthStatus = {
  has_users: boolean
  demo_mode: boolean
}

export const api = {
  auth: {
    status: () => request<AuthStatus>('/api/auth/status'),
    login: (username: string, password: string) =>
      request<{ username: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    setup: (username: string, password: string) =>
      request<{ username: string }>('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  },

  zones: {
    list: () => request<Zone[]>('/api/zones'),
    get: (id: string) => request<Zone>(`/api/zones/${id}`),
    create: (body: { name: string; valve_device_id: string; sensor_device_id: string; area_m2?: number }) =>
      request<Zone>('/api/zones', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Zone>) =>
      request<Zone>(`/api/zones/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/zones/${id}`, { method: 'DELETE' }),
    assignProfile: (id: string, profileId: string) =>
      request<Zone>(`/api/zones/${id}/profile`, { method: 'POST', body: JSON.stringify({ profile_id: profileId }) }),
    setGrowthStage: (id: string, stage: string) =>
      request<Zone>(`/api/zones/${id}/growth-stage`, { method: 'PATCH', body: JSON.stringify({ growth_stage: stage }) }),
    water: (id: string, duration_min?: number) =>
      request<Run>(`/api/zones/${id}/water`, { method: 'POST', body: JSON.stringify({ duration_min }) }),
    skipNext: (id: string) => request<void>(`/api/zones/${id}/skip-next`, { method: 'POST' }),
    history: (id: string, hours: 24 | 168 = 24) =>
      request<MoistureReading[]>(`/api/zones/${id}/history?hours=${hours}`),
    runs: (id: string) => request<Run[]>(`/api/zones/${id}/runs`),
  },

  profiles: {
    list: () => request<PlantProfile[]>('/api/profiles'),
    get: (id: string) => request<PlantProfile>(`/api/profiles/${id}`),
    create: (body: Partial<PlantProfile>) =>
      request<PlantProfile>('/api/profiles', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<PlantProfile>) =>
      request<PlantProfile>(`/api/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/profiles/${id}`, { method: 'DELETE' }),
  },

  schedules: {
    list: (zone_id?: string) =>
      request<Schedule[]>(`/api/schedules${zone_id ? `?zone_id=${zone_id}` : ''}`),
    create: (body: Omit<Schedule, 'id'>) =>
      request<Schedule>('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Schedule>) =>
      request<Schedule>(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/schedules/${id}`, { method: 'DELETE' }),
  },

  devices: {
    list: () => request<Device[]>('/api/devices'),
    get: (id: string) => request<Device>(`/api/devices/${id}`),
    candidates: (kind?: 'sense' | 'valve') =>
      request<DeviceCandidate[]>(`/api/devices/candidates${kind ? `?kind=${kind}` : ''}`),
    restart: (id: string) => request<void>(`/api/devices/${id}/restart`, { method: 'POST' }),
    clearError: (id: string) => request<Device>(`/api/devices/${id}/clear-error`, { method: 'POST' }),
    unpair: (id: string) => request<void>(`/api/devices/${id}/unpair`, { method: 'POST' }),
    pair: (body: { device_id?: string; ip?: string; pairing_code: string }) =>
      request<Device>('/api/devices/pair', { method: 'POST', body: JSON.stringify(body) }),
    mockAnnounce: (kind: 'sense' | 'valve', ip?: string) =>
      request<DeviceCandidate>('/api/devices/mock/announce', { method: 'POST', body: JSON.stringify({ kind, ip }) }),
  },

  alerts: {
    list: (status?: 'active' | 'acknowledged' | 'resolved') =>
      request<Alert[]>(`/api/alerts${status ? `?status=${status}` : ''}`),
    acknowledge: (id: string) => request<Alert>(`/api/alerts/${id}/acknowledge`, { method: 'POST' }),
  },

  settings: {
    getLocation: () => request<HubLocation | null>('/api/settings/location'),
    setLocation: (body: HubLocation) =>
      request<HubLocation>('/api/settings/location', { method: 'PUT', body: JSON.stringify(body) }),
  },

  onboarding: {
    progress: () => request<OnboardingProgress>('/api/onboarding/progress'),
    saveProgress: (body: { current_step: number; state_snapshot?: Record<string, unknown> }) =>
      request<OnboardingProgress>('/api/onboarding/progress', { method: 'POST', body: JSON.stringify(body) }),
    complete: () => request<OnboardingProgress>('/api/onboarding/complete', { method: 'POST' }),
  },

  mock: {
    state: () => request<MockState>('/api/mock/state'),
    setMoisture: (value: number) =>
      request<void>('/api/mock/moisture/set', { method: 'POST', body: JSON.stringify({ value }) }),
    setWeather: (body: { condition: string; rain_forecast_mm?: number; temp_c?: number }) =>
      request<void>('/api/mock/weather/set', { method: 'POST', body: JSON.stringify(body) }),
    setTimeScale: (scale: number) =>
      request<void>('/api/mock/time/scale', { method: 'POST', body: JSON.stringify({ scale }) }),
    setScenario: (name: string) =>
      request<void>('/api/mock/scenario', { method: 'POST', body: JSON.stringify({ name }) }),
    reset: () => request<void>('/api/mock/reset', { method: 'POST' }),
  },
}
