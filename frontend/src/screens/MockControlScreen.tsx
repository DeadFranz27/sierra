import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { MockState } from '../lib/api'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'

const SCENARIOS = ['default', 'dry_spell', 'rainy_week', 'heatwave', 'healthy_garden']
const WEATHER_CONDITIONS = ['sunny', 'cloudy', 'rainy']
const TIME_SCALES = [1, 10, 60, 360]

export function MockControlScreen() {
  const [state, setState] = useState<MockState | null>(null)
  const [moisture, setMoisture] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const s = await api.mock.state()
      setState(s)
      setMoisture(Math.round(s.moisture))
    } catch (e) {
      setError('Cannot reach mock-hub. Is it running?')
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [])

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await refresh() }
    catch (e) { alert((e as Error).message) }
  }

  const conditionTone = (c: string) => c === 'rainy' ? 'info' : c === 'cloudy' ? 'neutral' : 'good'

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#805821' }}>
            Mock mode active
          </div>
          <Badge label="SIMULATION" tone="warn" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--fg-brand)', margin: 0, letterSpacing: '-0.02em' }}>Demo controls</h1>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', marginTop: 6 }}>
          Adjust mock-hub physics in real time. Changes take effect immediately.
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>Connecting to mock-hub…</div>}

      {error && (
        <div style={{ padding: 16, background: 'var(--clay-100)', border: '1px solid var(--clay-300)', borderRadius: 12, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--clay-500)', marginBottom: 20 }}>
          <Icon name="warn" size={14} style={{ marginRight: 8 }} />{error}
        </div>
      )}

      {!loading && state && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
          }}>
            <div style={{ padding: 18, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>Soil moisture</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, color: 'var(--fg-brand)', lineHeight: 1 }}>{state.moisture.toFixed(1)}<span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', marginLeft: 3 }}>%</span></div>
            </div>
            <div style={{ padding: 18, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>Weather</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge label={state.weather.condition} tone={conditionTone(state.weather.condition)} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg-muted)' }}>{state.weather.temp_c.toFixed(0)}°C</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', marginTop: 6 }}>Rain: {state.weather.rain_forecast_mm.toFixed(1)} mm</div>
            </div>
            <div style={{ padding: 18, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>Time scale</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, color: 'var(--fg-brand)', lineHeight: 1 }}>{state.time_scale}×</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Set soil moisture</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="range" min={0} max={100} value={moisture}
                  onChange={e => setMoisture(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--fern-500)' }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, minWidth: 36 }}>{moisture}%</span>
              </div>
              <button
                onClick={() => act(() => api.mock.setMoisture(moisture))}
                style={{ marginTop: 12, padding: '8px 16px', background: 'var(--fg-brand)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >Apply</button>
            </div>

            <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Weather condition</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {WEATHER_CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => act(() => api.mock.setWeather({ condition: c }))}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: `1px solid ${state.weather.condition === c ? 'var(--accent)' : 'var(--border)'}`,
                      background: state.weather.condition === c ? 'var(--mist-300)' : 'var(--bg-elevated)',
                      color: state.weather.condition === c ? 'var(--fg-brand)' : 'var(--fg)',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Time scale</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {TIME_SCALES.map(s => (
                  <button
                    key={s}
                    onClick={() => act(() => api.mock.setTimeScale(s))}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: `1px solid ${state.time_scale === s ? 'var(--accent)' : 'var(--border)'}`,
                      background: state.time_scale === s ? 'var(--mist-300)' : 'var(--bg-elevated)',
                      color: state.time_scale === s ? 'var(--fg-brand)' : 'var(--fg)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >{s}×</button>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Scenario</div>
              <select
                defaultValue={state.scenario}
                onChange={e => act(() => api.mock.setScenario(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--fg)',
                  cursor: 'pointer',
                }}
              >
                {SCENARIOS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 0' }}>
            <button
              onClick={() => act(api.mock.reset)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px',
                background: 'var(--clay-100)',
                color: 'var(--clay-500)',
                border: '1px solid var(--clay-300)',
                borderRadius: 10,
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            ><Icon name="refresh" size={14} />Reset to defaults</button>
          </div>
        </div>
      )}
    </div>
  )
}
