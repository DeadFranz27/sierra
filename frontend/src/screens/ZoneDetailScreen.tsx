import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import type { Zone, MoistureReading, Run, Schedule, PlantProfile } from '../lib/api'
import { Sparkline } from '../components/Sparkline'
import { Badge } from '../components/Badge'
import { Stat } from '../components/Stat'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { toast } from '../components/Toast'
import { fmtHHMM } from '../lib/time'

function WaterModal({ maxMin, defaultMin, onConfirm, onClose }: { maxMin: number; defaultMin: number; onConfirm: (d: number) => void; onClose: () => void }) {
  const [duration, setDuration] = useState(Math.min(defaultMin, maxMin))
  return (
    <Modal title="Water now" onClose={onClose} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)' }}>
          Choose how long to run. Max allowed by profile: <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>{maxMin} min</b>.
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="range" min={1} max={maxMin} value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--fern-500)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--fg-brand)', minWidth: 52, textAlign: 'right' }}>{duration} min</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, cursor: 'pointer', color: 'var(--fg)' }}>Cancel</button>
          <button onClick={() => onConfirm(duration)} style={{ padding: '9px 18px', background: 'var(--fg-brand)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
            Start watering
          </button>
        </div>
      </div>
    </Modal>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const GROWTH_STAGES = ['seedling', 'established', 'dormant']

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

type Props = {
  zoneId: string
  onBack: () => void
}

export function ZoneDetailScreen({ zoneId, onBack }: Props) {
  const [zone, setZone] = useState<Zone | null>(null)
  const [history, setHistory] = useState<MoistureReading[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [profiles, setProfiles] = useState<PlantProfile[]>([])
  const [historyHours, setHistoryHours] = useState<24 | 168>(24)
  const [loading, setLoading] = useState(true)
  const [watering, setWatering] = useState(false)
  const [showAssignProfile, setShowAssignProfile] = useState(false)
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [showWaterModal, setShowWaterModal] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // New schedule form state
  const [newDays, setNewDays] = useState<number[]>([1, 3, 5])
  const [newTime, setNewTime] = useState('06:00')
  const [newDuration, setNewDuration] = useState(10)
  const [newSmart, setNewSmart] = useState(true)

  async function reload() {
    const [z, hist, rs, scheds] = await Promise.all([
      api.zones.get(zoneId),
      api.zones.history(zoneId, historyHours),
      api.zones.runs(zoneId),
      api.schedules.list(zoneId),
    ])
    setZone(z)
    setHistory(hist)
    setRuns(rs)
    setSchedules(scheds)
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [profs] = await Promise.all([api.profiles.list()])
        if (!mounted) return
        setProfiles(profs)
        await reload()
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [zoneId])

  useEffect(() => {
    if (!loading) reload()
  }, [historyHours])

  async function handleWater(duration_min?: number) {
    setWatering(true)
    setShowWaterModal(false)
    try {
      await api.zones.water(zoneId, duration_min)
      toast('Watering started', 'good')
    } catch (e) {
      toast('Could not start watering', 'bad')
    } finally {
      setWatering(false)
      await reload()
    }
  }

  async function handleSkip() {
    await api.zones.skipNext(zoneId)
    toast('Next scheduled run will be skipped', 'good')
  }

  async function handleSaveName() {
    if (!nameInput.trim() || nameInput === zone?.name) { setEditingName(false); return }
    try {
      await api.zones.update(zoneId, { name: nameInput.trim() })
      toast('Zone renamed', 'good')
      await reload()
    } catch { toast('Could not rename zone', 'bad') }
    setEditingName(false)
  }

  async function handleAssignProfile(profileId: string) {
    await api.zones.assignProfile(zoneId, profileId)
    setShowAssignProfile(false)
    toast('Profile assigned', 'good')
    await reload()
  }

  async function handleGrowthStage(stage: string) {
    await api.zones.setGrowthStage(zoneId, stage)
    await reload()
  }

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.schedules.create({ zone_id: zoneId, days_of_week: newDays, time_local: newTime, duration_min: newDuration, smart: newSmart, enabled: true })
      setShowAddSchedule(false)
      toast('Schedule added', 'good')
      await reload()
    } catch { toast('Could not add schedule', 'bad') }
  }

  async function handleDeleteSchedule(id: string) {
    try {
      await api.schedules.delete(id)
      toast('Schedule removed', 'good')
      await reload()
    } catch { toast('Could not remove schedule', 'bad') }
  }

  async function handleToggleSchedule(s: Schedule) {
    await api.schedules.update(s.id, { enabled: !s.enabled })
    toast(s.enabled ? 'Schedule disabled' : 'Schedule enabled', 'good')
    await reload()
  }

  if (loading || !zone) {
    return (
      <div style={{ padding: 28, maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton width={140} height={16} radius={6} />
        <Skeleton width={320} height={44} radius={10} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={86} radius={12} />)}
        </div>
        <Skeleton height={260} radius={14} />
      </div>
    )
  }

  const latestMoisture = history.length > 0 ? history[history.length - 1].value_percent : null
  const latestTemp = history.length > 0 ? history[history.length - 1].temp_c : null
  const sparkData = history.map(r => r.value_percent)
  const sparkLabels = history.map(r => fmtHHMM(r.timestamp))
  const profile = zone.active_profile

  const moistureTone = (v: number) => v < 40 ? 'warn' : v > 75 ? 'info' : 'good'

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {/* Water duration modal */}
      {showWaterModal && (
        <WaterModal
          maxMin={zone.active_profile?.max_run_min ?? 15}
          defaultMin={zone.active_profile?.default_run_min ?? 5}
          onConfirm={handleWater}
          onClose={() => setShowWaterModal(false)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={onBack} className="btn-int" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 4px', borderRadius: 8, marginBottom: 6, marginLeft: -4 }}>
          <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} />
          Back to zones
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>Zone detail</div>
            {editingName ? (
              <input
                ref={nameRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                autoFocus
                style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--fg-brand)', background: 'transparent', border: 'none', borderBottom: '2px solid var(--border-focus)', outline: 'none', letterSpacing: '-0.02em', width: '100%', padding: '0 0 2px' }}
              />
            ) : (
              <h1
                onClick={() => { setNameInput(zone.name); setEditingName(true) }}
                title="Click to rename"
                style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--fg-brand)', margin: 0, letterSpacing: '-0.02em', cursor: 'text', display: 'inline-flex', alignItems: 'center', gap: 10 }}
              >
                {zone.name}
                <Icon name="edit" size={18} color="var(--fg-muted)" />
              </h1>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={handleSkip} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--bg-elevated)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <Icon name="skip" size={14} /> Skip next
            </button>
            <button onClick={() => setShowWaterModal(true)} disabled={watering} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: watering ? 'var(--moss-400)' : 'var(--fg-brand)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <Icon name="play" size={14} /> {watering ? 'Watering…' : 'Water now'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <Stat
          label="Soil moisture"
          value={latestMoisture != null ? latestMoisture.toFixed(0) : '—'}
          unit="%"
          sub={latestMoisture != null ? (latestMoisture < 40 ? 'Needs water' : latestMoisture > 75 ? 'Well watered' : 'Comfortable') : 'No data'}
          tone={latestMoisture != null ? `var(--state-${moistureTone(latestMoisture)})` : undefined}
        />
        <Stat label="Temperature" value={latestTemp != null ? latestTemp.toFixed(0) : '—'} unit="°C" sub="Latest reading" />
        <Stat label="Profile" value={profile?.name ?? 'None'} sub={profile ? `${profile.moisture_target}% target` : 'Assign a profile'} />
        <Stat label="Stage" value={zone.growth_stage} sub="Growth stage" />
      </div>

      {/* Sparkline card */}
      <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
            Soil moisture history
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([24, 168] as const).map(h => (
              <button key={h} onClick={() => setHistoryHours(h)} style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${historyHours === h ? 'var(--accent)' : 'var(--border)'}`,
                background: historyHours === h ? 'var(--mist-300)' : 'var(--bg-elevated)',
                color: historyHours === h ? 'var(--fg-brand)' : 'var(--fg-muted)',
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{h === 24 ? '24h' : '7d'}</button>
            ))}
          </div>
        </div>
        {sparkData.length > 1
          ? <Sparkline data={sparkData} labels={sparkLabels} height={220} unit="%" />
          : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No readings</div>
        }
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Profile card */}
        <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
              Plant profile
            </div>
            <button
              onClick={() => setShowAssignProfile(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg)' }}
            >
              <Icon name="edit" size={12} /> Change
            </button>
          </div>

          {showAssignProfile && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {profiles.map(p => (
                <button key={p.id} onClick={() => handleAssignProfile(p.id)} style={{
                  padding: '8px 12px', textAlign: 'left',
                  background: zone.active_profile_id === p.id ? 'var(--mist-300)' : 'var(--bg)',
                  border: `1px solid ${zone.active_profile_id === p.id ? 'var(--moss-300)' : 'var(--border)'}`,
                  borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 13,
                  color: zone.active_profile_id === p.id ? 'var(--fg-brand)' : 'var(--fg)',
                  fontWeight: zone.active_profile_id === p.id ? 600 : 400,
                  cursor: 'pointer',
                }}>
                  {p.name}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--fg-muted)' }}>{p.moisture_target}% target</span>
                </button>
              ))}
            </div>
          )}

          {profile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600 }}>{profile.name}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{profile.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 4 }}>
                {[['Dry', profile.moisture_dry], ['Target', profile.moisture_target], ['Wet', profile.moisture_wet]].map(([l, v]) => (
                  <div key={l} style={{ padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--fg-brand)' }}>{v}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', flexWrap: 'wrap' }}>
                <span><b style={{ fontWeight: 600 }}>Run:</b> {profile.default_run_min} min</span>
                <span><b style={{ fontWeight: 600 }}>Max:</b> {profile.max_run_min} min</span>
                <span><b style={{ fontWeight: 600 }}>Interval:</b> {profile.min_interval_hours} h</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No profile assigned.</div>
          )}

          <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>Growth stage</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {GROWTH_STAGES.map(s => (
                <button key={s} onClick={() => handleGrowthStage(s)} style={{
                  padding: '6px 12px', borderRadius: 7,
                  border: `1px solid ${zone.growth_stage === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: zone.growth_stage === s ? 'var(--mist-300)' : 'var(--bg-elevated)',
                  color: zone.growth_stage === s ? 'var(--fg-brand)' : 'var(--fg)',
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Schedules card */}
        <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
              Schedules
            </div>
            <button
              onClick={() => setShowAddSchedule(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--fg-brand)', border: 'none', borderRadius: 7, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#fff' }}
            >
              <Icon name="plus" size={12} /> Add
            </button>
          </div>

          {showAddSchedule && (
            <form onSubmit={handleAddSchedule} style={{ marginBottom: 14, padding: 12, background: 'var(--bg-sunken)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 6 }}>Days</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DAYS.map((d, i) => (
                    <button type="button" key={d} onClick={() => setNewDays(prev => prev.includes(i+1) ? prev.filter(x => x !== i+1) : [...prev, i+1])} style={{
                      width: 34, height: 34, borderRadius: 7,
                      border: `1px solid ${newDays.includes(i+1) ? 'var(--accent)' : 'var(--border)'}`,
                      background: newDays.includes(i+1) ? 'var(--mist-300)' : 'var(--bg-elevated)',
                      color: newDays.includes(i+1) ? 'var(--fg-brand)' : 'var(--fg)',
                      fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>{d.slice(0,2)}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>Time</div>
                  <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} required
                    style={{ width: '100%', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>Duration (min)</div>
                  <input type="number" min={1} max={60} value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} required
                    style={{ width: '100%', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                <input type="checkbox" checked={newSmart} onChange={e => setNewSmart(e.target.checked)} style={{ accentColor: 'var(--fern-500)' }} />
                Smart scheduling (skip if soil is at target or rain expected)
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddSchedule(false)} style={{ padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-sans)', fontSize: 13, cursor: 'pointer', color: 'var(--fg)' }}>Cancel</button>
                <button type="submit" style={{ padding: '7px 14px', background: 'var(--fg-brand)', border: 'none', borderRadius: 7, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>Save</button>
              </div>
            </form>
          )}

          {schedules.length === 0 && !showAddSchedule && (
            <div style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No schedules. Add one to automate watering.</div>
          )}

          {schedules.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px dashed var(--border)', opacity: s.enabled ? 1 : 0.5 }}>
              <div style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{s.days_of_week.map(d => DAYS[d-1]).join(', ')} · {s.time_local}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                  {s.duration_min} min{s.smart ? ' · smart' : ''}
                </div>
              </div>
              <button onClick={() => handleToggleSchedule(s)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: s.enabled ? 'var(--state-good)' : 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="power" size={13} />
              </button>
              <button onClick={() => handleDeleteSchedule(s.id)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--state-bad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Run history */}
      <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 14 }}>
          Run history (last 10)
        </div>
        {runs.length === 0 && <div style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No runs yet.</div>}
        {runs.map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px dashed var(--border)', fontFamily: 'var(--font-sans)', fontSize: 13, alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', width: 160, flexShrink: 0 }}>{formatTs(r.started_at)}</div>
            <div style={{ flex: 1 }}>
              <Badge
                label={r.skipped ? 'Skipped' : r.trigger === 'manual' ? 'Manual' : 'Scheduled'}
                tone={r.skipped ? 'neutral' : r.trigger === 'manual' ? 'info' : 'good'}
              />
              {r.skipped && r.skip_reason && (
                <span style={{ marginLeft: 8, color: 'var(--fg-muted)', fontSize: 12 }}>{r.skip_reason}</span>
              )}
            </div>
            {!r.skipped && r.duration_min != null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', flexShrink: 0 }}>{r.duration_min.toFixed(0)} min</div>
            )}
            {r.moisture_before != null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', flexShrink: 0 }}>{r.moisture_before.toFixed(0)}% before</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
