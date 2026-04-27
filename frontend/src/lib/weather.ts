// Sierra weather state → motto + animated icon mapping
// Mirrors Sierra Design System v2.0 (ui_kits/_shared/weather-state.jsx).

export type WeatherCondition =
  | 'clear' | 'partly_cloudy' | 'overcast'
  | 'drizzle' | 'heavy_rain' | 'thunderstorm'
  | 'snow' | 'hail' | 'frost'
  | 'heat' | 'windy' | 'fog'
  | 'night' | 'dust' | 'recovery'

export const WEATHER_MOTTOS: Record<WeatherCondition, string[]> = {
  clear:         ['The garden is quiet.', 'Soaking up the sun.', 'Long, bright afternoon.'],
  partly_cloudy: ['Light slips through.', 'A gentle afternoon, no rush.', 'Comfort in the in-between.'],
  overcast:      ['Soft grey day.', 'The light is patient today.', 'Holding still under cloud.'],
  drizzle:       ['Drinking on its own.', 'The sky is helping today.', 'A patient soak.'],
  heavy_rain:    ['Sit this one out.', 'The sky has it covered.', "Skipping today's run."],
  thunderstorm:  ['A loud afternoon.', 'Holding everything inside.', 'Nothing scheduled — for safety.'],
  snow:          ['A white morning.', 'Pipes are sleeping. So is Sierra.', 'Standing by until thaw.'],
  hail:          ['Tucked in tight.', 'Hiding from the sky.', 'Tender leaves under cover.'],
  frost:         ['Below the line.', 'Lines drained, plants quiet.', 'Waiting out the freeze.'],
  heat:          ['Long thirst kind of day.', 'Pulling extra water early.', 'The sun is doing too much.'],
  windy:         ["Catching its breath.", 'Holding the spray for calmer air.', 'Wind has the floor.'],
  fog:           ['Wrapped in soft.', 'Drinking the morning air.', 'Slow start, settled garden.'],
  night:         ['Asleep, but listening.', 'Cooling down. Roots resting.', 'Quiet after hours.'],
  dust:          ['The air is heavy.', 'Letting the leaves rest.', 'Skipping the misters today.'],
  recovery:      ['Coming back slowly.', 'Soil still full from yesterday.', 'Easy day. The ground remembers.'],
}

// WMO weather codes (Open-Meteo). https://open-meteo.com/en/docs
function fromWmoCode(code: number, isDay: boolean): WeatherCondition | null {
  if (code === 0) return isDay ? 'clear' : 'night'
  if (code === 1 || code === 2) return isDay ? 'partly_cloudy' : 'night'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if ([51, 53, 55, 56, 57, 61, 80].includes(code)) return 'drizzle'
  if ([63, 65, 66, 67, 81, 82].includes(code)) return 'heavy_rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([95, 96, 99].includes(code)) return 'thunderstorm'
  return null
}

export type DeriveInput = {
  weatherCode?: number | null
  isDay?: boolean | null
  temperatureC?: number | null
  tempMinC?: number | null
  tempMaxC?: number | null
  windKmh?: number | null
  precip24hMm?: number | null   // total precipitation past 24 h
  precipNextMm?: number | null  // precipitation in current hour (for hail intensity guess)
}

/**
 * Derives the v2.0 condition key from Open-Meteo current-hour data, applying
 * the cheatsheet thresholds: frost (temp<2°C), heat (≥32°C), windy (>25 km/h),
 * recovery (rain past 24h ≥ 8 mm). Returns 'clear' as a safe fallback.
 */
export function deriveCondition(input: DeriveInput): WeatherCondition {
  const isDay = input.isDay ?? true

  // Hard overrides on top of WMO mapping
  const tMin = input.tempMinC ?? input.temperatureC ?? 99
  if (tMin < 2) return 'frost'

  const tMax = input.tempMaxC ?? input.temperatureC ?? 0
  if (tMax >= 32) return 'heat'

  const wind = input.windKmh ?? 0
  if (wind > 25) return 'windy'

  const fromCode = input.weatherCode != null ? fromWmoCode(input.weatherCode, isDay) : null
  if (fromCode) return fromCode

  // Recovery: significant rain in past 24h but currently dry/clear
  if ((input.precip24hMm ?? 0) >= 8 && (input.precipNextMm ?? 0) < 0.2) return 'recovery'

  return isDay ? 'clear' : 'night'
}

/**
 * Picks one of the three mottos for the condition, rotating 3× per day so the
 * primary motto isn't the only one ever seen.
 */
export function pickMotto(condition: WeatherCondition, now: Date = new Date()): string {
  const mottos = WEATHER_MOTTOS[condition]
  const slot = Math.floor(now.getHours() / 8) % mottos.length
  return mottos[slot]
}
