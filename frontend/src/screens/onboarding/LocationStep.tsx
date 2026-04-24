import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { WizardSnapshot } from './types'

type Props = {
  snapshot: WizardSnapshot
  onBack: () => void
  onDone: (patch: Partial<WizardSnapshot>) => void
  onSkip: () => void
}

type GeocodeResult = {
  label: string
  latitude: number
  longitude: number
}

async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0]
  return {
    label: first.display_name,
    latitude: parseFloat(first.lat),
    longitude: parseFloat(first.lon),
  }
}

export function LocationStep({ snapshot, onBack, onDone, onSkip }: Props) {
  const [query, setQuery] = useState(snapshot.location_label ?? '')
  const [resolved, setResolved] = useState<GeocodeResult | null>(
    snapshot.location_lat != null && snapshot.location_lon != null && snapshot.location_label
      ? { label: snapshot.location_label, latitude: snapshot.location_lat, longitude: snapshot.location_lon }
      : null,
  )
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setError('')
    setNotFound(false)
    setSearching(true)
    try {
      const hit = await geocode(query.trim())
      if (!hit) {
        setNotFound(true)
        setResolved(null)
      } else {
        setResolved(hit)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSearching(false)
    }
  }

  async function handleConfirm() {
    if (!resolved) return
    setError('')
    setSaving(true)
    try {
      await api.settings.setLocation({
        label: resolved.label,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      })
      onDone({
        location_label: resolved.label,
        location_lat: resolved.latitude,
        location_lon: resolved.longitude,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the location')
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="eyebrow loc-1" style={{ marginBottom: 12, textAlign: 'center' }}>
        Step 2 of 3 — Your location
      </div>

      <h2
        className="loc-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          lineHeight: 'var(--lh-snug)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--fg-brand)',
          marginBottom: 14,
          textAlign: 'center',
        }}
      >
        Where's the garden?
      </h2>

      <p className="lead loc-2" style={{ marginBottom: 28, textAlign: 'center' }}>
        We use this to skip watering when rain is in the forecast.
        <br />
        You can set it later if you prefer.
      </p>

      <form onSubmit={handleSearch} className="loc-2" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="loc-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setNotFound(false) }}
          placeholder="City, address or postal code — e.g. London"
          autoFocus
        />
        <button
          type="submit"
          className="loc-search-btn"
          disabled={searching || !query.trim()}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {notFound && (
        <div
          className="loc-result"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--amber-100)',
            border: '1px solid var(--amber-300)',
            borderRadius: 'var(--rad-sm)',
            fontSize: 'var(--text-sm)',
            color: 'var(--amber-500)',
          }}
        >
          No results. Try a larger city or double-check the spelling.
        </div>
      )}

      {resolved && (
        <div
          key={resolved.label}
          className="loc-result"
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            background: 'var(--mist-300)',
            border: '1px solid var(--moss-200)',
            borderRadius: 'var(--rad-md)',
          }}
        >
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--moss-700)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 'var(--tracking-eyebrow)' }}>
            Found
          </div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--fg)', marginBottom: 6, lineHeight: 1.4 }}>
            {resolved.label}
          </div>
          <div className="mono" style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-xs)' }}>
            {resolved.latitude.toFixed(4)}, {resolved.longitude.toFixed(4)}
          </div>
        </div>
      )}

      {error && (
        <div
          className="loc-result"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--clay-100)',
            border: '1px solid var(--clay-300)',
            borderRadius: 'var(--rad-sm)',
            fontSize: 'var(--text-sm)',
            color: 'var(--clay-500)',
          }}
        >
          {error}
        </div>
      )}

      <div className="caption loc-3" style={{ marginTop: 20, textAlign: 'center' }}>
        Search powered by OpenStreetMap Nominatim.
      </div>

      <div className="loc-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginTop: 8, borderTop: '1px solid var(--border)' }}>
        <button type="button" className="loc-secondary" onClick={onBack} disabled={saving}>
          Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="loc-skip" onClick={onSkip} disabled={saving}>
            Skip for now
          </button>
          <button
            type="button"
            className="loc-primary"
            onClick={handleConfirm}
            disabled={!resolved || saving}
          >
            {saving ? 'Saving…' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
