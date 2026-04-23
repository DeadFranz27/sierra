import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import type { PlantProfile } from '../../lib/api'
import { PlantCategoryIcon } from '../../components/PlantCategoryIcon'
import type { WizardSnapshot } from './types'

type Props = {
  snapshot: WizardSnapshot
  onBack: () => void
  onDone: (patch: Partial<WizardSnapshot>) => void
}

const DEFAULT_VALVE = 'valve-01'
const DEFAULT_SENSOR = 'sense-01'

async function resolveDeviceIds(): Promise<{ valveId: string; sensorId: string }> {
  try {
    const devs = await api.devices.list()
    const valve = devs.find(d => d.kind === 'valve' && d.paired_at)
    const sensor = devs.find(d => d.kind === 'sense' && d.paired_at)
    return {
      valveId: valve?.id ?? DEFAULT_VALVE,
      sensorId: sensor?.id ?? DEFAULT_SENSOR,
    }
  } catch {
    return { valveId: DEFAULT_VALVE, sensorId: DEFAULT_SENSOR }
  }
}

export function ZoneStep({ snapshot, onBack, onDone }: Props) {
  const [name, setName] = useState(snapshot.zone_name ?? '')
  const [profileId, setProfileId] = useState<string | null>(snapshot.profile_id ?? null)
  const [profiles, setProfiles] = useState<PlantProfile[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [profileError, setProfileError] = useState('')

  const alreadyCreated = Boolean(snapshot.zone_name)

  useEffect(() => {
    let mounted = true
    api.profiles.list()
      .then(ps => { if (mounted) setProfiles(ps) })
      .catch(e => { if (mounted) setError(e instanceof Error ? e.message : 'Impossibile caricare i profili') })
    return () => { mounted = false }
  }, [])

  const presets = useMemo(
    () => (profiles ?? []).filter(p => p.is_preset),
    [profiles],
  )

  function validate(): boolean {
    let ok = true
    if (!name.trim()) { setNameError('Dai un nome alla zona'); ok = false } else setNameError('')
    if (!profileId) { setProfileError('Scegli un profilo'); ok = false } else setProfileError('')
    return ok
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      if (!alreadyCreated) {
        const { valveId, sensorId } = await resolveDeviceIds()
        const zone = await api.zones.create({
          name: name.trim(),
          valve_device_id: valveId,
          sensor_device_id: sensorId,
        })
        await api.zones.assignProfile(zone.id, profileId!)
      }
      onDone({ zone_name: name.trim(), profile_id: profileId! })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante la creazione')
      setSaving(false)
    }
  }

  return (
    <div>
      <style>{`
        @keyframes sierra-zone-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .zone-1 { animation: sierra-zone-in var(--dur-emphasis) var(--ease-standard) both; }
        .zone-2 { animation: sierra-zone-in var(--dur-emphasis) var(--ease-standard) 100ms both; }
        .zone-3 { animation: sierra-zone-in var(--dur-emphasis) var(--ease-standard) 220ms both; }
        .zone-4 { animation: sierra-zone-in var(--dur-emphasis) var(--ease-standard) 340ms both; }

        .zone-input {
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
        .zone-input:focus { border-color: var(--border-focus); box-shadow: var(--focus-ring); }
        .zone-input.err { border-color: var(--clay-500); }

        .preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
        }
        .preset-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--rad-md);
          cursor: pointer;
          transition: transform var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard);
          text-align: center;
        }
        .preset-card:hover { border-color: var(--border-strong); transform: translateY(-1px); }
        .preset-card.selected {
          border-color: var(--accent);
          background: var(--mist-300);
          box-shadow: 0 0 0 3px rgba(78,122,92,.14);
        }
        .preset-check {
          position: absolute;
          top: 8px; right: 8px;
          width: 18px; height: 18px;
          border-radius: var(--rad-pill);
          background: var(--accent);
          color: #fff;
          font-size: 12px; line-height: 18px;
          opacity: 0;
          transform: scale(.6);
          transition: all var(--dur-base) var(--ease-standard);
        }
        .preset-card.selected .preset-check { opacity: 1; transform: scale(1); }

        .zone-primary {
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
        .zone-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--elev-2); }
        .zone-primary:active { background: var(--accent-press); transform: translateY(0); }
        .zone-primary:disabled { background: var(--moss-400); cursor: not-allowed; transform: none; box-shadow: none; }

        .zone-secondary {
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
        .zone-secondary:hover { border-color: var(--border-strong); color: var(--fg); }

        .field-error {
          margin-top: 6px;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--state-bad);
        }
      `}</style>

      <div className="eyebrow zone-1" style={{ marginBottom: 12, textAlign: 'center' }}>
        Passo 1 di 3 — La tua zona
      </div>

      <h2
        className="zone-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          lineHeight: 'var(--lh-snug)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--fg-brand)',
          marginBottom: 28,
          textAlign: 'center',
        }}
      >
        Parliamo della tua prima zona.
      </h2>

      {alreadyCreated && (
        <div
          className="zone-2"
          style={{
            marginBottom: 20,
            padding: '10px 14px',
            background: 'var(--mist-300)',
            border: '1px solid var(--moss-200)',
            borderRadius: 'var(--rad-sm)',
            fontSize: 'var(--text-sm)',
            color: 'var(--moss-700)',
          }}
        >
          Zona già creata. Puoi aggiornare il profilo e continuare.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="zone-2">
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--fg-muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-eyebrow)',
            }}
          >
            Come la chiamerai?
          </label>
          <input
            className={`zone-input ${nameError ? 'err' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="es. Orto sul retro, Vasi balcone, Prato"
            autoFocus
            disabled={alreadyCreated}
          />
          {nameError && <div className="field-error">{nameError}</div>}
        </div>

        <div className="zone-3">
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--fg-muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-eyebrow)',
            }}
          >
            Che cosa ci cresce?
          </label>

          {profiles === null ? (
            <div style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', padding: '12px 0' }}>
              Carico i profili…
            </div>
          ) : presets.length === 0 ? (
            <div style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', padding: '12px 0' }}>
              Nessun profilo preset disponibile.
            </div>
          ) : (
            <div className="preset-grid">
              {presets.map(p => {
                const selected = p.id === profileId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setProfileId(p.id); setProfileError('') }}
                    className={`preset-card ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                  >
                    <span className="preset-check">✓</span>
                    <PlantCategoryIcon category={p.category ?? 'Vegetables'} size={36} />
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: selected ? 'var(--fg-brand)' : 'var(--fg)',
                      }}
                    >
                      {p.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {profileError && <div className="field-error">{profileError}</div>}
        </div>

        {error && (
          <div
            className="zone-4"
            style={{
              padding: '10px 12px',
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

        <div className="zone-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <button type="button" className="zone-secondary" onClick={onBack} disabled={saving}>
            Indietro
          </button>
          <button type="submit" className="zone-primary" disabled={saving}>
            {saving ? 'Creazione…' : 'Avanti'}
          </button>
        </div>
      </form>
    </div>
  )
}
