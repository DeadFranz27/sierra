// Sierra v2.0 animated weather icon — 1:1 port of
// Sierra Design System 2.0/ui_kits/_shared/weather-state.jsx
import { useEffect } from 'react'
import type { WeatherCondition } from '../lib/weather'

const KEYFRAMES = `
@keyframes sw-rays { 0%,100% { opacity:.55 } 50% { opacity:1 } }
@keyframes sw-rotate { from { transform:rotate(0) } to { transform:rotate(360deg) } }
@keyframes sw-drift { 0%,100% { transform:translateX(-2px) } 50% { transform:translateX(2px) } }
@keyframes sw-drift-slow { 0%,100% { transform:translateX(-1.5px) } 50% { transform:translateX(1.5px) } }
@keyframes sw-rain { 0% { transform:translateY(0); opacity:0 } 20% { opacity:1 } 80% { opacity:1 } 100% { transform:translateY(14px); opacity:0 } }
@keyframes sw-snow { 0% { transform:translateY(0) translateX(0); opacity:0 } 25% { opacity:1 } 75% { opacity:1 } 100% { transform:translateY(14px) translateX(2px); opacity:0 } }
@keyframes sw-bolt { 0%,88%,100% { opacity:0; transform:translateY(-2px) scale(.92) } 90% { opacity:1; transform:translateY(0) scale(1) } 92% { opacity:.2 } 94% { opacity:1; transform:translateY(0) scale(1.05) } 96% { opacity:.4 } 98% { opacity:1 } }
@keyframes sw-darken { 0%,100% { fill-opacity:.85 } 90%,96% { fill-opacity:1 } }
@keyframes sw-wind { 0%,100% { stroke-dashoffset:0 } 50% { stroke-dashoffset:-8 } }
@keyframes sw-mist { 0%,100% { transform:translateX(0); opacity:.6 } 50% { transform:translateX(3px); opacity:1 } }
@keyframes sw-pulse { 0%,100% { opacity:.85 } 50% { opacity:1 } }
@keyframes sw-hail { 0% { transform:translateY(-2px); opacity:0 } 30% { opacity:1 } 100% { transform:translateY(14px); opacity:0 } }
.sw-sun-core { transform-origin:24px 24px; animation: sw-rotate 22s linear infinite }
.sw-rays { transform-origin:24px 24px; animation: sw-rays 3s ease-in-out infinite }
.sw-cloud-drift { animation: sw-drift 6s ease-in-out infinite; transform-origin:center }
.sw-cloud-drift-slow { animation: sw-drift-slow 9s ease-in-out infinite; transform-origin:center }
.sw-storm-cloud { animation: sw-darken 3.5s ease-in-out infinite }
.sw-bolt { transform-origin:24px 32px; animation: sw-bolt 3.5s ease-in-out infinite }
.sw-rain { animation: sw-rain 1.4s ease-in infinite }
.sw-rain.d2 { animation-delay:.4s } .sw-rain.d3 { animation-delay:.8s } .sw-rain.d4 { animation-delay:.2s }
.sw-snow { animation: sw-snow 2.2s linear infinite }
.sw-snow.d2 { animation-delay:.55s } .sw-snow.d3 { animation-delay:1.1s }
.sw-wind { stroke-dasharray:4 4; animation: sw-wind 1.6s linear infinite }
.sw-mist { animation: sw-mist 4.5s ease-in-out infinite }
.sw-mist.d2 { animation-delay:1.5s }
.sw-pulse { animation: sw-pulse 3s ease-in-out infinite }
.sw-hail { animation: sw-hail 1.6s ease-in infinite }
.sw-hail.d2 { animation-delay:.5s } .sw-hail.d3 { animation-delay:1s }
@media (prefers-reduced-motion: reduce) {
  .sw-sun-core, .sw-rays, .sw-cloud-drift, .sw-cloud-drift-slow, .sw-storm-cloud,
  .sw-bolt, .sw-rain, .sw-snow, .sw-wind, .sw-mist, .sw-pulse, .sw-hail {
    animation: none !important;
  }
}
`

const STD_CLOUD = 'M10 23 Q4 23 4 17 Q4 12 10 12 Q11 6 18 6 Q22 2 27 6 Q33 3 35 11 Q42 11 42 17 Q42 23 36 23 Z'
const SMALL_CLOUD = 'M16 32 Q11 32 11 27 Q11 22 16 22 Q16 17 21 17 Q24 13 28 16 Q33 14 34 19 Q39 19 39 25 Q39 32 34 32 Z'
const TINY_CLOUD = 'M28 22 Q24 22 24 18 Q24 14 28 14 Q28 10 32 10 Q34 7 37 10 Q41 9 42 14 Q44 14 44 18 Q44 22 40 22 Z'

function injectKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById('sierra-weather-anim')) return
  const tag = document.createElement('style')
  tag.id = 'sierra-weather-anim'
  tag.textContent = KEYFRAMES
  document.head.appendChild(tag)
}

export function WeatherIcon({ state = 'clear', size = 48 }: { state?: WeatherCondition; size?: number }) {
  useEffect(() => { injectKeyframes() }, [])

  const props = { width: size, height: size, viewBox: '0 0 48 48', fill: 'none' as const }

  switch (state) {
    case 'clear':
      return (
        <svg {...props}>
          <g stroke="#C08A3E" strokeWidth="2" strokeLinecap="round" className="sw-rays">
            <path d="M24 6 V10" /><path d="M24 38 V42" /><path d="M6 24 H10" /><path d="M38 24 H42" />
            <path d="M11 11 L14 14" /><path d="M34 34 L37 37" /><path d="M37 11 L34 14" /><path d="M14 34 L11 37" />
          </g>
          <circle cx="24" cy="24" r="8" stroke="#C08A3E" strokeWidth="2" fill="#DDB277" fillOpacity="0.25" className="sw-sun-core" />
        </svg>
      )
    case 'partly_cloudy':
      return (
        <svg {...props}>
          <g stroke="#C08A3E" strokeWidth="2" strokeLinecap="round" className="sw-rays">
            <path d="M16 6 V9" /><path d="M6 16 H9" /><path d="M9 9 L11 11" />
          </g>
          <circle cx="16" cy="16" r="6" stroke="#C08A3E" strokeWidth="2" fill="#DDB277" fillOpacity="0.3" />
          <g className="sw-cloud-drift">
            <path d={SMALL_CLOUD} stroke="#5B6B7A" strokeWidth="2" fill="#fff" strokeLinejoin="round" />
          </g>
        </svg>
      )
    case 'overcast':
      return (
        <svg {...props}>
          <g className="sw-cloud-drift">
            <path d={STD_CLOUD} stroke="#5B6B7A" strokeWidth="2" fill="#E8ECEF" strokeLinejoin="round" />
          </g>
        </svg>
      )
    case 'drizzle':
      return (
        <svg {...props}>
          <path d={STD_CLOUD} stroke="#4E7A8C" strokeWidth="2" fill="#DDE6EB" strokeLinejoin="round" />
          <g stroke="#4E7A8C" strokeWidth="2" strokeLinecap="round">
            <path d="M16 30 L14 38" className="sw-rain" />
            <path d="M24 30 L22 38" className="sw-rain d2" />
            <path d="M32 30 L30 38" className="sw-rain d3" />
          </g>
        </svg>
      )
    case 'heavy_rain':
      return (
        <svg {...props}>
          <path d={STD_CLOUD} stroke="#2F5866" strokeWidth="2" fill="#B6C8D2" strokeLinejoin="round" />
          <g stroke="#2F5866" strokeWidth="2.5" strokeLinecap="round">
            <path d="M14 30 L11 40" className="sw-rain" />
            <path d="M20 30 L17 40" className="sw-rain d2" />
            <path d="M26 30 L23 40" className="sw-rain d3" />
            <path d="M32 30 L29 40" className="sw-rain d4" />
          </g>
        </svg>
      )
    case 'thunderstorm':
      return (
        <svg {...props}>
          <g className="sw-cloud-drift">
            <path d={STD_CLOUD} stroke="#5B6B7A" strokeWidth="2" fill="#E8ECEF" strokeLinejoin="round" className="sw-storm-cloud" />
          </g>
          <g className="sw-bolt">
            <path d="M22 25 L17 33 L22 33 L19 42 L29 29 L24 29 L27 23 Z" stroke="#C08A3E" strokeWidth="1.8" fill="#DDB277" strokeLinejoin="round" />
          </g>
        </svg>
      )
    case 'snow':
      return (
        <svg {...props}>
          <path d={STD_CLOUD} stroke="#5B6B7A" strokeWidth="2" fill="#F0F2F4" strokeLinejoin="round" />
          <g stroke="#7B8FA0" strokeWidth="1.6" strokeLinecap="round">
            <g className="sw-snow"><path d="M14 28 L14 34" /><path d="M11 31 L17 31" /><path d="M12 29 L16 33" /><path d="M16 29 L12 33" /></g>
            <g className="sw-snow d2"><path d="M24 30 L24 36" /><path d="M21 33 L27 33" /><path d="M22 31 L26 35" /><path d="M26 31 L22 35" /></g>
            <g className="sw-snow d3"><path d="M34 28 L34 34" /><path d="M31 31 L37 31" /><path d="M32 29 L36 33" /><path d="M36 29 L32 33" /></g>
          </g>
        </svg>
      )
    case 'hail':
      return (
        <svg {...props}>
          <path d={STD_CLOUD} stroke="#5B6B7A" strokeWidth="2" fill="#DDE6EB" strokeLinejoin="round" />
          <g stroke="#7B8FA0" strokeWidth="1.5" fill="#fff">
            <circle cx="14" cy="32" r="2.4" className="sw-hail" />
            <circle cx="24" cy="34" r="2.4" className="sw-hail d2" />
            <circle cx="34" cy="32" r="2.4" className="sw-hail d3" />
          </g>
        </svg>
      )
    case 'frost':
      return (
        <svg {...props}>
          <g stroke="#7B8FA0" strokeWidth="2.5" strokeLinecap="round" className="sw-pulse">
            <path d="M16 14 L20 20 L16 26 L20 32 L16 38" />
            <path d="M28 14 L32 20 L28 26 L32 32 L28 38" />
          </g>
          <circle cx="24" cy="26" r="3.5" stroke="#4E7A8C" strokeWidth="2" fill="#fff" />
        </svg>
      )
    case 'heat':
      return (
        <svg {...props}>
          <g stroke="#A24B3B" strokeWidth="2" strokeLinecap="round" className="sw-rays">
            <path d="M24 4 V8" /><path d="M24 36 V40" /><path d="M4 22 H8" /><path d="M36 22 H40" />
            <path d="M9 7 L12 10" /><path d="M32 32 L35 35" /><path d="M35 7 L32 10" /><path d="M12 32 L9 35" />
          </g>
          <circle cx="22" cy="22" r="9" stroke="#A24B3B" strokeWidth="2" fill="#C08A3E" fillOpacity="0.4" className="sw-sun-core" />
        </svg>
      )
    case 'windy':
      return (
        <svg {...props}>
          <g stroke="#7B8FA0" strokeWidth="2.5" strokeLinecap="round">
            <path d="M8 16 C 14 16, 16 12, 22 12 C 28 12, 30 16, 36 16 L42 16" className="sw-wind" />
            <path d="M8 24 C 16 24, 18 20, 26 20 C 32 20, 34 24, 42 24" className="sw-wind" />
            <path d="M8 32 C 14 32, 16 28, 22 28 L34 28" className="sw-wind" />
          </g>
        </svg>
      )
    case 'fog':
      return (
        <svg {...props}>
          <g stroke="#7B8FA0" strokeWidth="2" strokeLinecap="round">
            <path d="M6 14 L34 14" className="sw-mist" />
            <path d="M10 20 L42 20" className="sw-mist d2" />
            <path d="M6 26 L36 26" className="sw-mist" />
            <path d="M10 32 L40 32" className="sw-mist d2" />
            <path d="M6 38 L34 38" className="sw-mist" />
          </g>
        </svg>
      )
    case 'night':
      return (
        <svg {...props}>
          <g className="sw-cloud-drift-slow">
            <path d={TINY_CLOUD} stroke="#7B8FA0" strokeWidth="1.8" fill="#fff" strokeLinejoin="round" />
          </g>
          <circle cx="20" cy="22" r="11" stroke="#5B6B7A" strokeWidth="2" fill="#E8ECEF" />
          <circle cx="15" cy="18" r="2.5" fill="#7B8FA0" />
          <circle cx="24" cy="24" r="1.8" fill="#7B8FA0" />
          <circle cx="23" cy="29" r="1.2" fill="#7B8FA0" />
        </svg>
      )
    case 'dust':
      return (
        <svg {...props}>
          <g stroke="#A87554" strokeWidth="2" strokeLinecap="round">
            <path d="M6 14 C 12 12, 18 16, 24 14 C 30 12, 36 16, 42 14" className="sw-mist" />
            <path d="M6 22 C 14 20, 22 24, 30 22 C 36 20, 40 22, 42 22" className="sw-mist d2" />
            <path d="M6 30 C 14 28, 22 32, 30 30 C 36 28, 40 30, 42 30" className="sw-mist" />
            <path d="M6 38 C 12 36, 18 40, 24 38 C 30 36, 36 40, 42 38" className="sw-mist d2" />
          </g>
        </svg>
      )
    case 'recovery':
      return (
        <svg {...props}>
          <g className="sw-cloud-drift">
            <path d={STD_CLOUD} stroke="#5B6B7A" strokeWidth="2" fill="#fff" strokeLinejoin="round" />
          </g>
          <g stroke="#C08A3E" strokeWidth="2" fill="none" strokeLinecap="round" className="sw-pulse">
            <path d="M14 30 Q 24 24, 34 30 Q 24 36, 14 30 Z" />
          </g>
        </svg>
      )
    default:
      return null
  }
}
