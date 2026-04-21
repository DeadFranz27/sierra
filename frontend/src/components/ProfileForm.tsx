import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PlantProfile } from '../lib/api'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SUN_OPTIONS = ['full', 'partial', 'shade']

type Props = {
  initial?: Partial<PlantProfile>
  onSubmit: (values: Partial<PlantProfile>) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </label>
      {children}
      {error && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--state-bad)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
  fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg)',
  outline: 'none', boxSizing: 'border-box',
}

const numStyle: React.CSSProperties = { ...inputStyle, fontFamily: 'var(--font-mono)' }

export function ProfileForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Save profile' }: Props) {
  const [name, setName] = useState(initial.name ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [dry, setDry] = useState(initial.moisture_dry ?? 30)
  const [target, setTarget] = useState(initial.moisture_target ?? 60)
  const [wet, setWet] = useState(initial.moisture_wet ?? 80)
  const [runMin, setRunMin] = useState(initial.default_run_min ?? 5)
  const [intervalH, setIntervalH] = useState(initial.min_interval_hours ?? 24)
  const [maxRun, setMaxRun] = useState(initial.max_run_min ?? 15)
  const [sun, setSun] = useState(initial.sun_preference ?? 'full')
  const [months, setMonths] = useState<number[]>(initial.season_active ?? [1,2,3,4,5,6,7,8,9,10,11,12])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (dry >= target) e.moisture = 'Dry must be less than target'
    if (target >= wet) e.moisture = (e.moisture ?? '') + ' · Target must be less than wet'
    if (dry < 0 || wet > 100) e.moisture = 'Values must be between 0 and 100'
    if (maxRun < 1 || maxRun > 30) e.maxRun = 'Must be between 1 and 30 min'
    if (intervalH < 1 || intervalH > 336) e.intervalH = 'Must be between 1 and 336 hours'
    if (months.length === 0) e.months = 'Select at least one month'
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSubmit({ name, description, moisture_dry: dry, moisture_target: target, moisture_wet: wet, default_run_min: runMin, min_interval_hours: intervalH, max_run_min: maxRun, sun_preference: sun, season_active: months })
    } finally {
      setSaving(false)
    }
  }

  function toggleMonth(m: number) {
    setMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a,b)=>a-b))
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <Field label="Profile name" error={errors.name}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My tomatoes" style={inputStyle}
          onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
      </Field>

      <Field label="Description (Sierra voice)">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          placeholder="Short sentence describing this plant's watering personality."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
      </Field>

      <Field label="Moisture thresholds (%)" error={errors.moisture}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[['Dry', dry, setDry], ['Target', target, setTarget], ['Wet', wet, setWet]].map(([label, val, setter]) => (
            <div key={label as string}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>{label as string}</div>
              <input type="number" min={0} max={100} value={val as number}
                onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                style={numStyle}
                onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
          ))}
        </div>
        {/* Live threshold preview bar */}
        <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: 'var(--stone-200)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: `${dry}%`, width: `${Math.max(0, target - dry)}%`, height: '100%', background: 'var(--amber-300)' }} />
          <div style={{ position: 'absolute', left: `${target}%`, width: `${Math.max(0, wet - target)}%`, height: '100%', background: 'var(--fern-400)' }} />
          <div style={{ position: 'absolute', left: `${wet}%`, right: 0, height: '100%', background: 'var(--water-300)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--fg-muted)', marginTop: 3 }}>
          <span>0%</span><span style={{ color: 'var(--amber-500)' }}>Dry {dry}%</span><span style={{ color: 'var(--fern-500)' }}>Target {target}%</span><span style={{ color: 'var(--water-500)' }}>Wet {wet}%</span><span>100%</span>
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Default run (min)">
          <input type="number" min={1} max={60} value={runMin} onChange={e => setRunMin(Number(e.target.value))} style={numStyle}
            onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
        </Field>
        <Field label="Max run (min)" error={errors.maxRun}>
          <input type="number" min={1} max={30} value={maxRun} onChange={e => setMaxRun(Number(e.target.value))} style={numStyle}
            onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
        </Field>
        <Field label="Min interval (h)" error={errors.intervalH}>
          <input type="number" min={1} max={336} value={intervalH} onChange={e => setIntervalH(Number(e.target.value))} style={numStyle}
            onFocus={e => e.target.style.borderColor='var(--border-focus)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
        </Field>
      </div>

      <Field label="Sun preference">
        <div style={{ display: 'flex', gap: 8 }}>
          {SUN_OPTIONS.map(s => (
            <button type="button" key={s} onClick={() => setSun(s)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8,
              border: `1px solid ${sun === s ? 'var(--accent)' : 'var(--border)'}`,
              background: sun === s ? 'var(--mist-300)' : 'var(--bg-elevated)',
              color: sun === s ? 'var(--fg-brand)' : 'var(--fg)',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: sun === s ? 600 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{s}</button>
          ))}
        </div>
      </Field>

      <Field label="Active seasons" error={errors.months}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {MONTHS.map((m, i) => (
            <button type="button" key={m} onClick={() => toggleMonth(i + 1)} style={{
              width: 38, height: 32, borderRadius: 7,
              border: `1px solid ${months.includes(i+1) ? 'var(--accent)' : 'var(--border)'}`,
              background: months.includes(i+1) ? 'var(--mist-300)' : 'var(--bg-elevated)',
              color: months.includes(i+1) ? 'var(--fg-brand)' : 'var(--fg-muted)',
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
            }}>{m}</button>
          ))}
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <button type="button" onClick={onCancel} style={{
          padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14, cursor: 'pointer', color: 'var(--fg)',
        }}>Cancel</button>
        <button type="submit" disabled={saving} style={{
          padding: '9px 18px', background: saving ? 'var(--moss-400)' : 'var(--fg-brand)',
          border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontSize: 14,
          fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff',
        }}>{saving ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  )
}
