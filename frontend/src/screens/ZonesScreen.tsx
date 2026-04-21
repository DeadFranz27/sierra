import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { Zone } from '../lib/api'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { toast } from '../components/Toast'

function moistureTone(v: number): 'warn' | 'good' | 'info' {
  if (v < 40) return 'warn'
  if (v > 75) return 'info'
  return 'good'
}

function MoistureBar({ value }: { value: number }) {
  const dry = value < 45
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--stone-200)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: dry ? 'var(--state-warn)' : 'linear-gradient(90deg,var(--mist-500),var(--water-500))' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: dry ? 'var(--state-warn)' : 'var(--fg-brand)', minWidth: 32, textAlign: 'right' }}>
        {value.toFixed(0)}%
      </span>
    </div>
  )
}

type ZoneRowProps = {
  zone: Zone
  n: number
  latestMoisture: number | null
  onWater: (id: string) => void
  onSkip: (id: string) => void
  onDelete: (id: string) => void
  onClick: (id: string) => void
}

function ZoneRow({ zone, n, latestMoisture, onWater, onSkip, onDelete, onClick }: ZoneRowProps) {
  const moisture = latestMoisture ?? 0
  const tone = moistureTone(moisture)
  const statusLabel = latestMoisture == null ? 'No data' : tone === 'warn' ? 'Dry' : tone === 'info' ? 'Well watered' : 'Comfortable'

  return (
    <div
      onClick={() => onClick(zone.id)}
      style={{ display: 'grid', gridTemplateColumns: '44px 1.3fr .9fr 130px 130px 120px', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: 13.5, cursor: 'pointer', transition: 'background 120ms' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--mist-100)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{String(n).padStart(2, '0')}</div>
      <div style={{ fontWeight: 600, color: 'var(--fg)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.name}</div>
      <div style={{ color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.active_profile?.name ?? '—'}</div>
      {latestMoisture != null ? <MoistureBar value={moisture} /> : <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>—</span>}
      <Badge label={statusLabel} tone={tone} />
      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        <button title="Skip next run" onClick={() => onSkip(zone.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="skip" size={13} />
        </button>
        <button title="Water now" onClick={() => onWater(zone.id)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--fg-brand)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play" size={13} />
        </button>
        <button title="Delete zone" onClick={() => onDelete(zone.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--state-bad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  )
}

function AddZoneModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [valveId, setValveId] = useState('valve-01')
  const [sensorId, setSensorId] = useState('sense-01')
  const [area, setArea] = useState('')
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg)', outline: 'none', boxSizing: 'border-box' }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const zone = await api.zones.create({ name, valve_device_id: valveId, sensor_device_id: sensorId, area_m2: area ? Number(area) : undefined })
      toast('Zone created', 'good')
      onCreated(zone.id)
    } catch (err) {
      toast('Could not create zone: ' + (err as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add zone" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { label: 'Zone name', value: name, setter: setName, placeholder: 'e.g. Back lawn', required: true },
          { label: 'Valve device ID', value: valveId, setter: setValveId, placeholder: 'valve-01', required: true },
          { label: 'Sensor device ID', value: sensorId, setter: setSensorId, placeholder: 'sense-01', required: true },
          { label: 'Area (m², optional)', value: area, setter: setArea, placeholder: '12', required: false },
        ].map(({ label, value, setter, placeholder, required }) => (
          <div key={label}>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</label>
            <input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} required={required} style={inputStyle}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, cursor: 'pointer', color: 'var(--fg)' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: saving ? 'var(--moss-400)' : 'var(--fg-brand)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
            {saving ? 'Creating…' : 'Create zone'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

type Props = { onSelectZone: (id: string) => void }

export function ZonesScreen({ onSelectZone }: Props) {
  const [zones, setZones] = useState<Zone[]>([])
  const [moistures, setMoistures] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  async function loadZones() {
    const zs = await api.zones.list()
    setZones(zs)
    const ms: Record<string, number> = {}
    for (const z of zs) {
      const hist = await api.zones.history(z.id, 24)
      if (hist.length > 0) ms[z.id] = hist[hist.length - 1].value_percent
    }
    setMoistures(ms)
  }

  useEffect(() => {
    let mounted = true
    loadZones().finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleWater(id: string) {
    try {
      await api.zones.water(id)
      toast('Watering started', 'good')
    } catch (e) {
      toast('Could not start watering', 'bad')
    }
  }

  async function handleSkip(id: string) {
    await api.zones.skipNext(id)
    toast('Next run will be skipped', 'good')
  }

  async function handleDelete(id: string) {
    const zone = zones.find(z => z.id === id)
    if (!confirm(`Delete zone "${zone?.name}"? This cannot be undone.`)) return
    try {
      await api.zones.delete(id)
      setZones(prev => prev.filter(z => z.id !== id))
      toast('Zone deleted', 'good')
    } catch {
      toast('Could not delete zone', 'bad')
    }
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {showAdd && (
        <AddZoneModal
          onClose={() => setShowAdd(false)}
          onCreated={id => { setShowAdd(false); loadZones(); onSelectZone(id) }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
            {zones.length} zone{zones.length !== 1 ? 's' : ''} configured
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--fg-brand)', margin: 0, letterSpacing: '-0.02em' }}>Zones</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--fg-brand)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="plus" size={15} /> Add zone
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>Loading zones…</div>}

      {!loading && zones.length === 0 && (
        <div style={{ padding: 40, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 15, marginBottom: 16 }}>No zones yet. Add your first zone to get started.</div>
          <button onClick={() => setShowAdd(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--fg-brand)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            <Icon name="plus" size={15} /> Add zone
          </button>
        </div>
      )}

      {!loading && zones.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1.3fr .9fr 130px 130px 120px', gap: 16, padding: '11px 20px', background: 'var(--stone-100)', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
            <span>#</span><span>Zone</span><span>Plant</span><span>Soil</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {zones.map((z, i) => (
            <ZoneRow key={z.id} zone={z} n={i + 1} latestMoisture={moistures[z.id] ?? null}
              onWater={handleWater} onSkip={handleSkip} onDelete={handleDelete} onClick={onSelectZone} />
          ))}
        </div>
      )}
    </div>
  )
}
