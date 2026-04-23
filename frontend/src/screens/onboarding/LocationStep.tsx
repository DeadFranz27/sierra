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
  if (!res.ok) throw new Error(`Geocoding fallito (${res.status})`)
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
      setError(err instanceof Error ? err.message : 'Errore di rete')
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
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio')
      setSaving(false)
    }
  }

  return (
    <div>
      <style>{`
        @keyframes sierra-loc-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sierra-loc-pop {
          from { opacity: 0; transform: scale(.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .loc-1 { animation: sierra-loc-in var(--dur-emphasis) var(--ease-standard) both; }
        .loc-2 { animation: sierra-loc-in var(--dur-emphasis) var(--ease-standard) 100ms both; }
        .loc-3 { animation: sierra-loc-in var(--dur-emphasis) var(--ease-standard) 220ms both; }
        .loc-result { animation: sierra-loc-pop var(--dur-base) var(--ease-standard) both; }

        .loc-input {
          width: 100%;
          padding: 12px 14px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--rad-sm);
          font-family: var(--font-sans);
          font-size: var(--text-base);
          color: var(--fg);
          outline: none;
          transition: border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard);
        }
        .loc-input:focus { border-color: var(--border-focus); box-shadow: var(--focus-ring); }

        .loc-search-btn {
          padding: 10px 18px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          color: var(--fg);
          border-radius: var(--rad-sm);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--dur-base) var(--ease-standard);
          white-space: nowrap;
        }
        .loc-search-btn:hover { background: var(--bg); }
        .loc-search-btn:disabled { opacity: .6; cursor: not-allowed; }

        .loc-primary {
          padding: 11px 24px;
          background: var(--fg-brand);
          color: #fff;
          border: none;
          border-radius: var(--rad-pill);
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: var(--text-sm);
          cursor: pointer;
          box-shadow: var(--elev-1);
          transition: all var(--dur-base) var(--ease-standard);
        }
        .loc-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--elev-2); }
        .loc-primary:active { background: var(--accent-press); transform: translateY(0); }
        .loc-primary:disabled { background: var(--moss-400); cursor: not-allowed; transform: none; box-shadow: none; }

        .loc-secondary {
          padding: 10px 20px;
          background: transparent;
          color: var(--fg-muted);
          border: 1px solid var(--border);
          border-radius: var(--rad-pill);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--dur-base) var(--ease-standard);
        }
        .loc-secondary:hover { border-color: var(--border-strong); color: var(--fg); }

        .loc-skip {
          background: transparent;
          border: none;
          color: var(--fg-subtle);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          padding: 6px 10px;
        }
        .loc-skip:hover { color: var(--fg-muted); }
      `}</style>

      <div className="eyebrow loc-1" style={{ marginBottom: 12, textAlign: 'center' }}>
        Passo 2 di 3 — La tua posizione
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
        Dove si trova il giardino?
      </h2>

      <p className="lead loc-2" style={{ marginBottom: 28, textAlign: 'center' }}>
        Serve per saltare l'irrigazione quando è prevista pioggia.
        <br />
        Puoi anche lasciarlo per dopo.
      </p>

      <form onSubmit={handleSearch} className="loc-2" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="loc-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setNotFound(false) }}
          placeholder="Città, indirizzo o CAP — es. Milano"
          autoFocus
        />
        <button
          type="submit"
          className="loc-search-btn"
          disabled={searching || !query.trim()}
        >
          {searching ? 'Cerco…' : 'Cerca'}
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
          Nessun risultato. Prova con una città più grande o controlla l'ortografia.
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
            Trovato
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
        La ricerca usa OpenStreetMap Nominatim.
      </div>

      <div className="loc-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginTop: 8, borderTop: '1px solid var(--border)' }}>
        <button type="button" className="loc-secondary" onClick={onBack} disabled={saving}>
          Indietro
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="loc-skip" onClick={onSkip} disabled={saving}>
            Salta per ora
          </button>
          <button
            type="button"
            className="loc-primary"
            onClick={handleConfirm}
            disabled={!resolved || saving}
          >
            {saving ? 'Salvataggio…' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}
