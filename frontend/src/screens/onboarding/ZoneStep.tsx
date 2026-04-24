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
      .catch(e => { if (mounted) setError(e instanceof Error ? e.message : 'Could not load profiles') })
    return () => { mounted = false }
  }, [])

  const presets = useMemo(
    () => (profiles ?? []).filter(p => p.is_preset),
    [profiles],
  )

  function validate(): boolean {
    let ok = true
    if (!name.trim()) { setNameError('Give the zone a name'); ok = false } else setNameError('')
    if (!profileId) { setProfileError('Pick a profile'); ok = false } else setProfileError('')
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
      setError(e instanceof Error ? e.message : 'Could not create the zone')
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="eyebrow zone-1" style={{ marginBottom: 12, textAlign: 'center' }}>
        Step 1 of 3 — Your zone
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
        Let's talk about your first zone.
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
          Zone already created. You can update the profile and continue.
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
            What will you call it?
          </label>
          <input
            className={`zone-input ${nameError ? 'err' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Back garden, Balcony pots, Front lawn"
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
            What grows there?
          </label>

          {profiles === null ? (
            <div style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', padding: '12px 0' }}>
              Loading profiles…
            </div>
          ) : presets.length === 0 ? (
            <div style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', padding: '12px 0' }}>
              No preset profiles available.
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
            Back
          </button>
          <button type="submit" className="zone-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Next'}
          </button>
        </div>
      </form>
    </div>
  )
}
