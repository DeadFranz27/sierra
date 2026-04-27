import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Zone, Run, HubLocation } from '../lib/api'
import { Stat } from '../components/Stat'
import { Sparkline } from '../components/Sparkline'
import { Icon } from '../components/Icon'
import { Skeleton } from '../components/Skeleton'
import { WeatherIcon } from '../components/WeatherIcon'
import { fmtHHMM, fmtRelative, fmtTodayLong } from '../lib/time'
import { deriveCondition, pickMotto } from '../lib/weather'

type WeatherWindow = 24 | 168

type WeatherPoint = {
  label: string
  mm: number
  wind: number
  ts?: number
  tempC?: number | null
  code?: number | null
  isDay?: boolean | null
}

async function fetchWeatherHistory(hours: WeatherWindow): Promise<WeatherPoint[]> {
  const data = await api.settings.weatherHistory(hours)
  const now = Date.now()
  const cutoff = now - hours * 3600 * 1000

  const points: WeatherPoint[] = []
  for (const p of data.points) {
    const ts = new Date(p.time).getTime()
    if (ts < cutoff || ts > now) continue
    const d = new Date(p.time)
    const label = hours === 24
      ? fmtHHMM(d)
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    points.push({
      label,
      mm: p.precipitation_mm,
      wind: p.wind_kmh,
      ts,
      tempC: p.temperature_c ?? null,
      code: p.weather_code ?? null,
      isDay: p.is_day ?? null,
    })
  }

  if (hours === 168) {
    const byDay: Record<string, WeatherPoint & { windCount: number }> = {}
    for (const p of points) {
      if (!byDay[p.label]) byDay[p.label] = { label: p.label, mm: 0, wind: 0, windCount: 0 }
      byDay[p.label].mm += p.mm
      byDay[p.label].wind += p.wind
      byDay[p.label].windCount++
    }
    return Object.values(byDay).map(d => ({
      label: d.label,
      mm: Math.round(d.mm * 10) / 10,
      wind: Math.round((d.wind / (d.windCount || 1)) * 10) / 10,
    }))
  }
  return points
}

function BarChart({ points, valueKey, color, unit, labelStep, summary }: {
  points: WeatherPoint[]
  valueKey: 'mm' | 'wind'
  color: string
  unit: string
  labelStep: number
  summary: ReactNode
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (points.length === 0) return <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No data</div>
  const vals = points.map(p => p[valueKey])
  const maxVal = Math.max(...vals, 0.5)
  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHoverIdx(null)}>
      {hovered !== null && hoverIdx !== null && (
        <div style={{
          position: 'absolute',
          bottom: 36,
          left: `${(hoverIdx / (points.length - 1)) * 100}%`,
          transform: hoverIdx > points.length * 0.7 ? 'translateX(-100%)' : hoverIdx < points.length * 0.3 ? 'translateX(0)' : 'translateX(-50%)',
          background: 'var(--moss-900)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        }}>
          <span style={{ opacity: 0.7, fontFamily: 'var(--font-sans)', fontSize: 11 }}>{hovered.label} </span>
          <b>{hovered[valueKey].toFixed(1)} {unit}</b>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
        {points.map((p, i) => {
          const v = p[valueKey]
          const pct = (v / maxVal) * 100
          const isHovered = hoverIdx === i
          return (
            <div
              key={i}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', cursor: 'crosshair' }}
              onMouseEnter={() => setHoverIdx(i)}
            >
              <div style={{
                width: '100%', borderRadius: '3px 3px 0 0',
                height: `${Math.max(pct, v > 0 ? 3 : 0)}%`,
                background: v > 0 ? color : 'var(--stone-200)',
                opacity: hoverIdx !== null && !isHovered ? 0.5 : 1,
                outline: isHovered ? `2px solid ${color}` : 'none',
                transition: 'opacity 100ms',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', overflow: 'hidden', whiteSpace: 'nowrap', opacity: i % labelStep === 0 ? 1 : 0 }}>
            {i % labelStep === 0 ? p.label : ''}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)' }}>{summary}</div>
    </div>
  )
}

const todayLabel = () => fmtTodayLong()
const formatTime = (iso: string) => fmtRelative(iso)

type Props = { onNavigate: (p: string) => void }

export function DashboardScreen({ onNavigate }: Props) {
  const [zones, setZones] = useState<Zone[]>([])
  const [history, setHistory] = useState<number[]>([])
  const [historyLabels, setHistoryLabels] = useState<string[]>([])
  const [recentRuns, setRecentRuns] = useState<(Run & { zoneName: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [weatherPoints, setWeatherPoints] = useState<WeatherPoint[]>([])
  const [weatherWindow, setWeatherWindow] = useState<WeatherWindow>(24)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [location, setLocation] = useState<HubLocation | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [zs, loc] = await Promise.all([api.zones.list(), api.settings.getLocation()])
        if (!mounted) return
        setZones(zs)
        setLocation(loc)
        if (loc) {
          setWeatherLoading(true)
          fetchWeatherHistory(24).then(pts => { if (mounted) setWeatherPoints(pts) }).finally(() => { if (mounted) setWeatherLoading(false) })
        }
        if (zs.length > 0) {
          const hist = await api.zones.history(zs[0].id, 24)
          if (mounted) {
            setHistory(hist.map(r => r.value_percent))
            setHistoryLabels(hist.map(r => fmtHHMM(r.timestamp)))
          }
          const allRuns: (Run & { zoneName: string })[] = []
          for (const z of zs) {
            const runs = await api.zones.runs(z.id)
            allRuns.push(...runs.map(r => ({ ...r, zoneName: z.name })))
          }
          allRuns.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
          if (mounted) setRecentRuns(allRuns.slice(0, 6))
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!location) return
    setWeatherLoading(true)
    fetchWeatherHistory(weatherWindow)
      .then(pts => setWeatherPoints(pts))
      .catch(() => {})
      .finally(() => setWeatherLoading(false))
  }, [weatherWindow, location])

  const primaryZone = zones[0]

  // v2.0 weather state — derive condition from current-hour Open-Meteo data,
  // pick a motto that rotates 3× per day so it doesn't feel static.
  const hourlyPoints = weatherPoints.filter(p => p.ts != null)
  const now = Date.now()
  const currentPoint = hourlyPoints
    .filter(p => (p.ts ?? 0) <= now)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))[0]
  const past24 = hourlyPoints.filter(p => (p.ts ?? 0) >= now - 24 * 3600 * 1000)
  const precip24h = past24.reduce((s, p) => s + (p.mm || 0), 0)
  const tempsToday = past24.map(p => p.tempC).filter((t): t is number => t != null)
  const condition = location
    ? deriveCondition({
        weatherCode: currentPoint?.code ?? null,
        isDay: currentPoint?.isDay ?? null,
        temperatureC: currentPoint?.tempC ?? null,
        tempMinC: tempsToday.length ? Math.min(...tempsToday) : null,
        tempMaxC: tempsToday.length ? Math.max(...tempsToday) : null,
        windKmh: currentPoint?.wind ?? null,
        precip24hMm: precip24h,
        precipNextMm: currentPoint?.mm ?? null,
      })
    : null
  const greeting = location && condition
    ? pickMotto(condition)
    : 'Your garden awaits.'

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        padding: '12px 16px',
        background: 'var(--mist-300)',
        border: '1px solid var(--moss-200)',
        borderRadius: 12,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: 'var(--moss-700)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--moss-700)' }}>
          <Icon name="lock" size={15} />
        </div>
        <div style={{ flex: 1 }}>
          <b style={{ fontWeight: 600 }}>You're connected directly to the Hub.</b>
          <span style={{ color: 'var(--moss-600)' }}> Data never leaves your network.</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>
            {todayLabel()}
          </div>
          {loading ? (
            <Skeleton width={420} height={44} radius={10} />
          ) : (
            <div className="fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              {condition && (
                <div style={{ flexShrink: 0 }}>
                  <WeatherIcon state={condition} size={48} />
                </div>
              )}
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.1, color: 'var(--fg-brand)', margin: 0, letterSpacing: '-0.02em', fontStyle: 'italic' }}>
                {greeting}
              </h1>
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigate('zones')}
          className="btn-int"
          style={{
            padding: '10px 18px',
            background: 'var(--fg-brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon name="play" size={14} />
          Run a zone
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <Stat label="Zones" value={zones.length} sub={`${zones.filter(z => z.active_profile_id).length} with a profile`} icon="sprout" />
        <Stat label="Avg soil" value={history.length > 0 ? history[history.length - 1] : '—'} unit="%" sub="Latest reading" icon="droplet" />
        <Stat label="Profiles" value="—" sub="Plant library" icon="leaf" />
        <Stat label="Status" value="Online" sub="Hub connected" tone="var(--state-good)" icon="cpu" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="lift fade-in-up" style={{
          padding: 20,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 2 }}>Soil · 24h</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--fg-brand)', letterSpacing: '-0.01em' }}>
                {primaryZone?.name ?? 'No zones yet'}
              </div>
            </div>
            {history.length > 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: '-0.03em', color: 'var(--fg-brand)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {history[history.length - 1].toFixed(0)}
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', marginLeft: 3 }}>%</span>
              </div>
            )}
          </div>
          {history.length > 0
            ? <Sparkline data={history} labels={historyLabels} height={170} unit="%" />
            : <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No readings yet</div>
          }
        </div>

        <div className="lift fade-in-up" style={{
          padding: 20,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 10 }}>
            Recent activity
          </div>
          {recentRuns.length === 0 && !loading && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)' }}>No runs yet.</div>
          )}
          {recentRuns.map(run => (
            <div key={run.id} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px dashed var(--border)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', width: 74, flexShrink: 0 }}>
                {formatTime(run.started_at)}
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontWeight: 600 }}>{run.zoneName}</b>{' '}
                <span style={{ color: 'var(--fg-muted)' }}>
                  {run.skipped ? `skipped · ${run.skip_reason ?? ''}` : `${run.trigger} run`}
                </span>
              </div>
              {!run.skipped && run.duration_min != null && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', flexShrink: 0 }}>
                  {run.duration_min.toFixed(0)} min
                </div>
              )}
            </div>
          ))}
          <div style={{ marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="db" size={13} /> Data stored on device
          </div>
        </div>
      </div>

      {/* Weather charts — rain + wind */}
      <div className="lift fade-in-up" style={{ marginTop: 16, padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 2 }}>
              Weather · {weatherWindow === 24 ? 'last 24 h' : 'last 7 days'}
            </div>
            {location && (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="pin" size={11} /> {location.label}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([24, 168] as const).map(w => (
              <button key={w} onClick={() => setWeatherWindow(w)} style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${weatherWindow === w ? 'var(--accent)' : 'var(--border)'}`,
                background: weatherWindow === w ? 'var(--mist-300)' : 'var(--bg-elevated)',
                color: weatherWindow === w ? 'var(--fg-brand)' : 'var(--fg-muted)',
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{w === 24 ? '24h' : '7d'}</button>
            ))}
          </div>
        </div>

        {!location && (
          <div style={{ padding: '16px 0', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="pin" size={14} />
            Set a location on the{' '}
            <b style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onNavigate('device')}>Device page</b>
            {' '}to see weather data.
          </div>
        )}

        {location && weatherLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <Skeleton height={80} radius={6} />
            <Skeleton height={80} radius={6} />
          </div>
        )}

        {location && !weatherLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="cloudRain" size={13} /> Rainfall (mm)
              </div>
              <BarChart
                points={weatherPoints}
                valueKey="mm"
                color="var(--water-500)"
                unit="mm"
                labelStep={weatherWindow === 24 ? 3 : 1}
                summary={(() => {
                  const total = weatherPoints.reduce((s, p) => s + p.mm, 0)
                  const max = Math.max(...weatherPoints.map(p => p.mm), 0)
                  return <span>Total <b style={{ fontFamily: 'var(--font-mono)', color: total > 0 ? 'var(--water-500)' : 'var(--fg-muted)' }}>{total.toFixed(1)} mm</b> · peak {max.toFixed(1)} mm/h</span>
                })()}
              />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="wind" size={13} /> Wind speed (km/h)
              </div>
              <BarChart
                points={weatherPoints}
                valueKey="wind"
                color="var(--stone-400)"
                unit="km/h"
                labelStep={weatherWindow === 24 ? 3 : 1}
                summary={(() => {
                  const avg = weatherPoints.length > 0 ? weatherPoints.reduce((s, p) => s + p.wind, 0) / weatherPoints.length : 0
                  const max = Math.max(...weatherPoints.map(p => p.wind), 0)
                  return <span>Avg <b style={{ fontFamily: 'var(--font-mono)' }}>{avg.toFixed(1)} km/h</b> · peak {max.toFixed(1)} km/h</span>
                })()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
