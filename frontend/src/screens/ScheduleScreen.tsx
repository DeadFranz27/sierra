import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { Zone, Schedule } from '../lib/api'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { toast } from '../components/Toast'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

type ScheduleBlock = Schedule & { zoneName: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
  fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg)',
  outline: 'none', boxSizing: 'border-box',
}

function AddScheduleModal({ zones, onClose, onCreated }: { zones: Zone[]; onClose: () => void; onCreated: (s: Schedule) => void }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [time, setTime] = useState('07:00')
  const [duration, setDuration] = useState(10)
  const [smart, setSmart] = useState(true)
  const [saving, setSaving] = useState(false)

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (days.length === 0) { toast('Select at least one day', 'bad'); return }
    setSaving(true)
    try {
      const created = await api.schedules.create({ zone_id: zoneId, days_of_week: days, time_local: time, duration_min: duration, smart, enabled: true })
      toast('Schedule created', 'good')
      onCreated(created)
    } catch (err) {
      toast('Could not create schedule: ' + (err as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add schedule" onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>Zone</label>
          <select value={zoneId} onChange={e => setZoneId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Days</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS.map((d, i) => (
              <button type="button" key={d} onClick={() => toggleDay(i + 1)} style={{
                flex: 1, height: 34, borderRadius: 8,
                border: `1px solid ${days.includes(i + 1) ? 'var(--accent)' : 'var(--border)'}`,
                background: days.includes(i + 1) ? 'var(--mist-300)' : 'var(--bg-elevated)',
                color: days.includes(i + 1) ? 'var(--fg-brand)' : 'var(--fg-muted)',
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>{d}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--border-focus)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>Duration (min)</label>
            <input type="number" min={1} max={60} value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              onFocus={e => e.target.style.borderColor = 'var(--border-focus)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Smart watering</label>
          <button type="button" onClick={() => setSmart(p => !p)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            border: `1px solid ${smart ? 'var(--accent)' : 'var(--border)'}`,
            background: smart ? 'var(--mist-300)' : 'var(--bg-elevated)',
            color: smart ? 'var(--fg-brand)' : 'var(--fg-muted)',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Icon name={smart ? 'check' : 'x'} size={14} />
            {smart ? 'Enabled — skips if soil is wet' : 'Disabled — always runs'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, cursor: 'pointer', color: 'var(--fg)' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: saving ? 'var(--moss-400)' : 'var(--fg-brand)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff' }}>
            {saving ? 'Creating…' : 'Create schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function ScheduleScreen() {
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [zs, scheds] = await Promise.all([api.zones.list(), api.schedules.list()])
        if (!mounted) return
        setZones(zs)
        const zMap = Object.fromEntries(zs.map((z: Zone) => [z.id, z.name]))
        setSchedules(scheds.map(s => ({ ...s, zoneName: zMap[s.zone_id] ?? 'Unknown' })))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function toggleEnabled(s: ScheduleBlock) {
    try {
      const updated = await api.schedules.update(s.id, { enabled: !s.enabled })
      setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, enabled: updated.enabled } : x))
      toast(updated.enabled ? 'Schedule enabled' : 'Schedule disabled', 'good')
    } catch { toast('Could not update schedule', 'bad') }
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Delete this schedule?')) return
    try {
      await api.schedules.delete(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
      toast('Schedule deleted', 'good')
    } catch { toast('Could not delete schedule', 'bad') }
  }

  function handleCreated(s: Schedule) {
    const zone = zones.find(z => z.id === s.zone_id)
    setSchedules(prev => [...prev, { ...s, zoneName: zone?.name ?? 'Unknown' }])
    setShowAdd(false)
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {showAdd && zones.length > 0 && (
        <AddScheduleModal zones={zones} onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
            Week view
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--fg-brand)', margin: 0, letterSpacing: '-0.02em' }}>
            Schedule
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--fg-brand)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="plus" size={15} /> Add schedule
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>Loading…</div>}

      {!loading && (
        <>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 18,
            marginBottom: 24,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px repeat(7, 1fr)',
              gap: 0,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8,
              marginBottom: 10,
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--fg-muted)',
            }}>
              <div />
              {DAYS.map(d => <div key={d} style={{ textAlign: 'center' }}>{d}</div>)}
            </div>

            <div style={{ position: 'relative', height: 280, display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div style={{ position: 'relative' }}>
                {[0, 6, 12, 18, 24].map(h => (
                  <div key={h} style={{
                    position: 'absolute', left: 0, top: `${(h / 24) * 100}%`,
                    transform: 'translateY(-50%)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)',
                  }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {DAYS.map((_, di) => (
                <div key={di} style={{ position: 'relative', borderLeft: '1px dashed var(--border)' }}>
                  {[6, 12, 18].map(h => (
                    <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: `${(h / 24) * 100}%`, borderTop: '1px dashed var(--border)', opacity: 0.6 }} />
                  ))}
                  {schedules
                    .filter(s => s.days_of_week.includes(di + 1) && s.enabled)
                    .map((s, i) => {
                      const t = parseTime(s.time_local)
                      const len = Math.max(s.duration_min / 60, 0.04)
                      return (
                        <div key={i} style={{
                          position: 'absolute', left: 4, right: 4,
                          top: `${(t / 24) * 100}%`,
                          height: `${(len / 24) * 100}%`,
                          background: 'var(--mist-500)',
                          border: '1px solid var(--moss-300)',
                          borderRadius: 6,
                          padding: '4px 6px',
                          fontSize: 11,
                          color: 'var(--moss-700)',
                          overflow: 'hidden',
                        }}>
                          <b style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.zoneName}</b>
                        </div>
                      )
                    })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr .8fr 80px 80px 80px 80px',
              gap: 16,
              padding: '11px 20px',
              background: 'var(--stone-100)',
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--fg-muted)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Zone</span><span>Days</span><span>Time</span><span>Duration</span><span>Smart</span><span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {schedules.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                No schedules yet.
              </div>
            )}

            {schedules.map(s => (
              <div key={s.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr .8fr 80px 80px 80px 80px',
                alignItems: 'center',
                gap: 16,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                opacity: s.enabled ? 1 : 0.5,
              }}>
                <div style={{ fontWeight: 600 }}>{s.zoneName}</div>
                <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
                  {s.days_of_week.map(d => DAYS[d - 1]).join(', ')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.time_local}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.duration_min} min</div>
                <div>{s.smart ? <Icon name="check" size={14} color="var(--state-good)" /> : <Icon name="x" size={14} color="var(--fg-muted)" />}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => toggleEnabled(s)}
                    title={s.enabled ? 'Disable' : 'Enable'}
                    style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: s.enabled ? 'var(--state-good)' : 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  ><Icon name="power" size={13} /></button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    title="Delete"
                    style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--state-bad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  ><Icon name="trash" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
