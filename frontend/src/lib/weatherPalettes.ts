// Sierra v2.5 weather palettes — sky gradient + tint + fg colors per condition.
// Mirrors Sierra Design System 2.5/ui_kits/_shared/weather-state.jsx.

import type { WeatherCondition } from './weather'

export type WeatherPalette = {
  sky: [string, string, string]
  cardTint: string
  accent: string
  fg: string
  shadow: string
}

export const WEATHER_PALETTES: Record<WeatherCondition, WeatherPalette> = {
  clear:         { sky: ['#FFE9B8', '#FFD089', '#F4A86A'], cardTint: 'rgba(244,168,106,0.05)', accent: '#C0743A', fg: '#3F2615', shadow: 'rgba(192,116,58,.18)' },
  partly_cloudy: { sky: ['#E5EEF5', '#D4E2EE', '#F2DCC4'], cardTint: 'rgba(212,226,238,0.07)', accent: '#5A7A92', fg: '#2C3947', shadow: 'rgba(90,122,146,.16)' },
  overcast:      { sky: ['#DCE2E8', '#C9D2DB', '#B8C2CC'], cardTint: 'rgba(184,194,204,0.07)', accent: '#566472', fg: '#2A323B', shadow: 'rgba(86,100,114,.14)' },
  drizzle:       { sky: ['#C5D2DC', '#A8B9C8', '#8FA3B5'], cardTint: 'rgba(143,163,181,0.08)', accent: '#3F5A6E', fg: '#1F2C38', shadow: 'rgba(63,90,110,.18)' },
  heavy_rain:    { sky: ['#8FA1B2', '#6F839A', '#4F6577'], cardTint: 'rgba(79,101,119,0.07)',  accent: '#2D4456', fg: '#FFFFFF', shadow: 'rgba(45,68,86,.28)' },
  thunderstorm:  { sky: ['#7A8294', '#5C6378', '#3D425A'], cardTint: 'rgba(61,66,90,0.07)',    accent: '#C58E2E', fg: '#FFFFFF', shadow: 'rgba(61,66,90,.32)' },
  snow:          { sky: ['#F4F7FA', '#E2EBF1', '#CDDAE3'], cardTint: 'rgba(205,218,227,0.10)', accent: '#5C7388', fg: '#2A3744', shadow: 'rgba(92,115,136,.14)' },
  hail:          { sky: ['#D7DEE5', '#B6C2CD', '#8E9FAC'], cardTint: 'rgba(142,159,172,0.07)', accent: '#4D6072', fg: '#1F2A35', shadow: 'rgba(77,96,114,.18)' },
  frost:         { sky: ['#EAF2F6', '#D2E1EB', '#B5CCDA'], cardTint: 'rgba(181,204,218,0.08)', accent: '#3E6B85', fg: '#22384A', shadow: 'rgba(62,107,133,.16)' },
  heat:          { sky: ['#FFD58A', '#F49C5C', '#D75A3A'], cardTint: 'rgba(215,90,58,0.06)',   accent: '#A33A1F', fg: '#3D1A0F', shadow: 'rgba(215,90,58,.22)' },
  windy:         { sky: ['#E0E6EA', '#C7D2D8', '#A6B4BC'], cardTint: 'rgba(166,180,188,0.07)', accent: '#4F6470', fg: '#26323A', shadow: 'rgba(79,100,112,.16)' },
  fog:           { sky: ['#E7E5DF', '#D4D2CC', '#BAB7B0'], cardTint: 'rgba(186,183,176,0.08)', accent: '#605A4E', fg: '#2E2A22', shadow: 'rgba(96,90,78,.14)' },
  night:         { sky: ['#293A52', '#1A2538', '#0E1726'], cardTint: 'rgba(14,23,38,0.06)',    accent: '#C9A86A', fg: '#F5EFE3', shadow: 'rgba(14,23,38,.34)' },
  dust:          { sky: ['#E8C99A', '#C99964', '#9A6736'], cardTint: 'rgba(154,103,54,0.06)',  accent: '#7A4A22', fg: '#2E1B0C', shadow: 'rgba(154,103,54,.20)' },
  recovery:      { sky: ['#DEEBE0', '#C2D8C4', '#9DBFA3'], cardTint: 'rgba(157,191,163,0.07)', accent: '#3F6E4B', fg: '#1F3326', shadow: 'rgba(63,110,75,.16)' },
}

const ORB_KEYFRAMES = `
@keyframes sw-orb-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(14px,8px) scale(1.06) } }
@keyframes sw-orb-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-12px,-10px) scale(1.08) } }
`

if (typeof document !== 'undefined' && !document.getElementById('sierra-orb-anim')) {
  const tag = document.createElement('style')
  tag.id = 'sierra-orb-anim'
  tag.textContent = ORB_KEYFRAMES
  document.head.appendChild(tag)
}
