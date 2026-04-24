import { useEffect, useState, useCallback, useRef } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { Device, DeviceCandidate, HubLocation } from '../lib/api'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { toast } from '../components/Toast'

// ─── helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 10) return 'Just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return `${Math.floor(hrs / 24)} d ago`
}

function rssiLabel(rssi: number | null): string {
  if (rssi == null) return '—'
  if (rssi > -50) return `${rssi} dBm · strong`
  if (rssi > -65) return `${rssi} dBm · good`
  if (rssi > -75) return `${rssi} dBm · weak`
  return `${rssi} dBm · poor`
}

function deviceTone(d: Device): 'good' | 'warn' | 'bad' | 'neutral' {
  if (d.status === 'offline') return 'neutral'
  if (d.status === 'error' || d.error_flag) return 'bad'
  if (d.status === 'degraded') return 'warn'
  return 'good'
}

function statusLabel(d: Device): string {
  if (d.status === 'offline') return 'OFFLINE'
  if (d.status === 'error') return 'ERROR'
  if (d.status === 'degraded') return 'DEGRADED'
  return 'ONLINE'
}

// ─── StatusDot ─────────────────────────────────────────────────────────────

function StatusDot({ tone }: { tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'var(--state-good)' : tone === 'warn' ? 'var(--state-warn)' : tone === 'bad' ? 'var(--state-bad)' : 'var(--stone-400)'
  const pulse = tone !== 'good'
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 10, height: 10, flexShrink: 0 }}>
      <span style={{ display: 'block', width: 10, height: 10, borderRadius: '50%', background: color }} />
      {pulse && (
        <span style={{
          position: 'absolute', inset: -3, borderRadius: '50%',
          border: `2px solid ${color}`, opacity: 0.4,
          animation: 'pulse 1.6s var(--ease-standard) infinite alternate',
        }} />
      )}
    </span>
  )
}

// ─── MetricRow ─────────────────────────────────────────────────────────────

function MetricRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid var(--border)',
      fontFamily: 'var(--font-sans)', fontSize: 13,
    }}>
      <span style={{ color: 'var(--fg-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 12, color: 'var(--fg)' }}>{value}</span>
    </div>
  )
}

// ─── DeviceCard ────────────────────────────────────────────────────────────

type DeviceCardProps = {
  device: Device | undefined
  onRestart: (id: string) => void
  onClearError: (id: string) => void
  onUnpair: (id: string) => void
  restarting: string | null
  onAddDevice?: () => void
}

function HubCard({ device }: { device: Device | undefined }) {
  if (!device) {
    return (
      <div style={cardStyle}>
        <CardHeader icon="cpu" title="Sierra Hub" subtitle="Raspberry Pi 4 · local" tone="neutral" statusLabel="NOT DETECTED" />
        <div style={{ padding: '14px 0', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
          Hub not registered. Check backend.
        </div>
      </div>
    )
  }
  const tone = deviceTone(device)
  return (
    <div style={cardStyle}>
      <CardHeader icon="cpu" title="Sierra Hub" subtitle={`Raspberry Pi 4 · local · ${device.ip_address ?? 'LAN'}`} tone={tone} statusLabel={statusLabel(device)} />
      {device.error_flag && device.error_message && (
        <ErrorBanner message={device.error_message} />
      )}
      <div style={{ marginTop: 8 }}>
        <MetricRow label="Firmware" value={device.firmware_version ?? '—'} />
        <MetricRow label="Last seen" value={timeAgo(device.last_seen)} mono={false} />
        <MetricRow label="Wi-Fi RSSI" value={rssiLabel(device.wifi_rssi)} mono={false} />
      </div>
    </div>
  )
}

function SenseCard({ device, onRestart, onClearError, restarting, onAddDevice }: DeviceCardProps) {
  if (!device) {
    return (
      <div style={cardStyle}>
        <CardHeader icon="activity" title="Sierra Sense" subtitle="ESP32 · not paired" tone="neutral" statusLabel="UNPAIRED" />
        <div style={{ padding: '14px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No Sense paired yet.</span>
          {onAddDevice && <button onClick={onAddDevice} style={primaryBtnStyle}><Icon name="plus" size={13} />Pair Sense</button>}
        </div>
      </div>
    )
  }
  const tone = deviceTone(device)
  return (
    <div style={cardStyle}>
      <CardHeader icon="activity" title="Sierra Sense" subtitle={`ESP32 · ${device.ip_address ?? '—'}`} tone={tone} statusLabel={statusLabel(device)} />
      {device.error_flag && device.error_message && (
        <ErrorBanner message={device.error_message} />
      )}
      <div style={{ marginTop: 8 }}>
        <MetricRow label="MAC" value={device.mac ?? '—'} />
        <MetricRow label="Firmware" value={device.firmware_version ?? '—'} />
        <MetricRow label="Wi-Fi signal" value={rssiLabel(device.wifi_rssi)} mono={false} />
        <MetricRow label="Last heartbeat" value={timeAgo(device.last_seen)} mono={false} />
        {device.paired_at && <MetricRow label="Paired" value={timeAgo(device.paired_at)} mono={false} />}
      </div>
      <CardActions
        deviceId={device.id}
        tone={tone}
        hasError={device.error_flag}
        restarting={restarting}
        onRestart={onRestart}
        onClearError={onClearError}
      />
    </div>
  )
}

function ValveCard({ device, onRestart, onClearError, onUnpair, restarting, onAddDevice }: DeviceCardProps) {
  if (!device) {
    return (
      <div style={cardStyle}>
        <CardHeader icon="droplet" title="Sierra Valve" subtitle="ESP32 · not paired" tone="neutral" statusLabel="UNPAIRED" />
        <div style={{ padding: '14px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>No Valve paired yet.</span>
          {onAddDevice && <button onClick={onAddDevice} style={primaryBtnStyle}><Icon name="plus" size={13} />Pair Valve</button>}
        </div>
      </div>
    )
  }
  const tone = deviceTone(device)

  let pumpStatusLabel = '—'
  let pumpBadgeTone: 'good' | 'warn' | 'bad' | 'neutral' = 'neutral'
  if (device.valve_state === 'OPEN') { pumpStatusLabel = 'Pumping'; pumpBadgeTone = 'good' }
  else if (device.valve_state === 'CLOSED') { pumpStatusLabel = 'Idle'; pumpBadgeTone = 'neutral' }

  const reservoirLabel = device.water_level == null ? '—' : device.water_level ? '● Has water' : '⚠ Empty'
  const reservoirColor = device.water_level == null ? 'var(--fg-muted)' : device.water_level ? 'var(--state-good)' : 'var(--state-warn)'

  return (
    <div style={cardStyle}>
      <CardHeader icon="droplet" title="Sierra Valve" subtitle={`ESP32 · ${device.ip_address ?? '—'}`} tone={tone} statusLabel={statusLabel(device)} />
      {device.error_flag && device.error_message && (
        <ErrorBanner message={device.error_message} />
      )}
      <div style={{ marginTop: 8 }}>
        <MetricRow label="MAC" value={device.mac ?? '—'} />
        <MetricRow label="Firmware" value={device.firmware_version ?? '—'} />
        <MetricRow label="Actuator" value={device.actuator_type ?? 'peristaltic_pump'} mono={false} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 0', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-sans)', fontSize: 13,
        }}>
          <span style={{ color: 'var(--fg-muted)' }}>Pump state</span>
          <Badge label={pumpStatusLabel} tone={pumpBadgeTone} dot />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 0', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-sans)', fontSize: 13,
        }}>
          <span style={{ color: 'var(--fg-muted)' }}>Reservoir</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: reservoirColor }}>{reservoirLabel}</span>
        </div>
        <MetricRow label="Wi-Fi signal" value={rssiLabel(device.wifi_rssi)} mono={false} />
        <MetricRow label="Last heartbeat" value={timeAgo(device.last_seen)} mono={false} />
        {device.paired_at && <MetricRow label="Paired" value={timeAgo(device.paired_at)} mono={false} />}
      </div>
      <CardActions
        deviceId={device.id}
        tone={tone}
        hasError={device.error_flag}
        restarting={restarting}
        onRestart={onRestart}
        onClearError={onClearError}
        onUnpair={onUnpair}
      />
    </div>
  )
}

// ─── sub-components ─────────────────────────────────────────────────────────

function CardHeader({ icon, title, subtitle, tone, statusLabel }: { icon: IconName; title: string; subtitle: string; tone: 'good' | 'warn' | 'bad' | 'neutral'; statusLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--rad-md)',
        background: 'var(--bg-sunken)', color: 'var(--fg-brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot tone={tone} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--fg-brand)', lineHeight: 1.2 }}>{title}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
      <Badge label={statusLabel} tone={tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : tone === 'bad' ? 'bad' : 'neutral'} />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      margin: '8px 0', padding: '10px 12px', borderRadius: 'var(--rad-sm)',
      background: 'var(--clay-100)', border: '1px solid var(--clay-300)',
      color: 'var(--clay-500)', fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.5,
    }}>
      <Icon name="warn" size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
      {message}
    </div>
  )
}

function CardActions({ deviceId, tone, hasError, restarting, onRestart, onClearError, onUnpair }: {
  deviceId: string; tone: string; hasError: boolean; restarting: string | null
  onRestart: (id: string) => void
  onClearError: (id: string) => void
  onUnpair?: (id: string) => void
}) {
  const busy = restarting === deviceId
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
      {tone !== 'good' && (
        <button
          onClick={() => onRestart(deviceId)}
          disabled={busy}
          style={secondaryBtnStyle}
        >
          <Icon name="refresh" size={13} />
          {busy ? 'Restarting…' : 'Restart'}
        </button>
      )}
      {hasError && (
        <button onClick={() => onClearError(deviceId)} style={secondaryBtnStyle}>
          <Icon name="xCircle" size={13} />
          Clear error
        </button>
      )}
      {onUnpair && (
        <button onClick={() => onUnpair(deviceId)} style={{ ...secondaryBtnStyle, color: 'var(--clay-500)', borderColor: 'var(--clay-300)' }}>
          <Icon name="unlink" size={13} />
          Unpair
        </button>
      )}
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: 20,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--rad-lg)',
  boxShadow: 'var(--elev-1)',
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--rad-sm)',
  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', color: 'var(--fg-muted)',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: 'var(--fg-brand)', color: '#fff',
  border: 'none', borderRadius: 'var(--rad-sm)',
  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}

// ─── LocationCard ────────────────────────────────────────────────────────────

function LocationCard() {
  const [loc, setLoc] = useState<HubLocation | null>(null)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [resolved, setResolved] = useState<HubLocation | null>(null)
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    api.settings.getLocation().then(l => {
      if (l) setLoc(l)
    }).catch(() => {})
  }, [])

  function openEdit() {
    setQuery(loc?.label ?? '')
    setResolved(loc)
    setNotFound(false)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setQuery('')
    setResolved(null)
    setNotFound(false)
  }

  async function doSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setNotFound(false)
    setResolved(null)
    try {
      const hit = await api.settings.geocode(q)
      if (!hit) {
        setNotFound(true)
      } else {
        setResolved({ label: hit.label, latitude: hit.latitude, longitude: hit.longitude })
      }
    } catch {
      toast('Could not reach geocoder', 'bad')
    } finally {
      setSearching(false)
    }
  }

  function detectGps() {
    if (!navigator.geolocation) { toast('Geolocation not supported by this browser', 'bad'); return }
    setDetecting(true)
    setNotFound(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5))
        const lon = parseFloat(pos.coords.longitude.toFixed(5))
        setResolved({ label: `GPS fix (${lat}, ${lon})`, latitude: lat, longitude: lon })
        setDetecting(false)
      },
      () => { toast('Could not get GPS position', 'bad'); setDetecting(false) },
      { timeout: 8000 },
    )
  }

  async function save() {
    if (!resolved) return
    setSaving(true)
    try {
      const saved = await api.settings.setLocation(resolved)
      setLoc(saved)
      cancelEdit()
      toast('Location saved', 'good')
    } catch {
      toast('Could not save location', 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: editing ? 16 : (loc ? 8 : 0) }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--rad-md)', background: 'var(--bg-sunken)', color: 'var(--fg-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pin" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--fg-brand)' }}>Location</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            {loc ? loc.label : 'Not set — required for weather & schedules'}
          </div>
        </div>
        {!editing && (
          <button onClick={openEdit} style={secondaryBtnStyle}>
            <Icon name="edit" size={13} />
            {loc ? 'Edit' : 'Set location'}
          </button>
        )}
      </div>

      {!editing && loc && (
        <div>
          <MetricRow label="Label" value={loc.label} mono={false} />
          <MetricRow label="Latitude" value={loc.latitude.toFixed(5)} />
          <MetricRow label="Longitude" value={loc.longitude.toFixed(5)} />
        </div>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <form onSubmit={doSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setNotFound(false) }}
              placeholder="City, address or postal code — e.g. London"
              style={{ flex: 1, padding: '8px 10px', fontFamily: 'var(--font-sans)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--rad-sm)', background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box' }}
            />
            <button type="submit" disabled={searching || !query.trim()} style={{ ...secondaryBtnStyle, fontSize: 12 }}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {notFound && (
            <div style={{ padding: '8px 10px', background: 'var(--amber-100)', border: '1px solid var(--amber-300)', borderRadius: 'var(--rad-sm)', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--amber-500)' }}>
              No results. Try a larger city or double-check the spelling.
            </div>
          )}

          {resolved && (
            <div style={{ padding: '10px 12px', background: 'var(--mist-300)', border: '1px solid var(--moss-200)', borderRadius: 'var(--rad-sm)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--moss-700)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>Found</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg)', lineHeight: 1.35, marginBottom: 3 }}>{resolved.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                {resolved.latitude.toFixed(4)}, {resolved.longitude.toFixed(4)}
              </div>
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)' }}>
            Search powered by OpenStreetMap Nominatim.
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={detectGps} disabled={detecting} style={{ ...secondaryBtnStyle, fontSize: 12 }}>
              <Icon name="pin" size={12} />
              {detecting ? 'Detecting…' : 'Use my GPS'}
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={cancelEdit} style={secondaryBtnStyle}>Cancel</button>
            <button onClick={save} disabled={saving || !resolved} style={{ ...primaryBtnStyle, opacity: (saving || !resolved) ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PairModal ───────────────────────────────────────────────────────────────

type PairStep = 'scan' | 'code'

function PairModal({ onClose, onPaired }: { onClose: () => void; onPaired: () => void }) {
  const [step, setStep] = useState<PairStep>('scan')
  const [candidates, setCandidates] = useState<DeviceCandidate[]>([])
  const [scanning, setScanning] = useState(true)
  const [selected, setSelected] = useState<DeviceCandidate | null>(null)
  const [manualIp, setManualIp] = useState('')
  const [code, setCode] = useState('')
  const [pairing, setPairing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scan = useCallback(async () => {
    try {
      const res = await api.devices.candidates()
      setCandidates(res)
    } catch {
      // silent
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    scan()
    pollRef.current = setInterval(scan, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [scan])

  async function handlePair() {
    const trimCode = code.trim()
    if (trimCode.length !== 6) { toast('Enter the 6-digit code shown on the device', 'bad'); return }
    setPairing(true)
    try {
      await api.devices.pair({
        device_id: selected?.id,
        ip: !selected ? manualIp || undefined : undefined,
        pairing_code: trimCode,
      })
      toast('Device paired successfully', 'good')
      onPaired()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pairing failed'
      toast(msg.includes('403') ? 'Wrong pairing code — check the display on the device' : msg.includes('409') ? 'Device already paired' : 'Pairing failed — check the code and try again', 'bad')
    } finally {
      setPairing(false)
    }
  }

  const kindLabel = (k: string) => k === 'sense' ? 'Sierra Sense' : k === 'valve' ? 'Sierra Valve' : k
  const kindIcon = (k: string): IconName => k === 'sense' ? 'activity' : 'droplet'

  return (
    <Modal title="Add device" onClose={onClose} width={480}>
      {step === 'scan' ? (
        <div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Devices on your network that are ready to pair will appear below. Make sure the device is powered on and connected to Wi-Fi.
          </p>

          {/* Candidate list */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-eyebrow)', color: 'var(--fg-muted)', marginBottom: 10 }}>
              Discovered devices {scanning && '· scanning…'}
            </div>
            {candidates.length === 0 ? (
              <div style={{
                padding: '20px 16px', borderRadius: 'var(--rad-md)',
                border: '1px dashed var(--border)', textAlign: 'center',
                fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)',
              }}>
                {scanning ? 'Scanning…' : 'No devices found yet. Checking every 4 seconds…'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {candidates.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setStep('code') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px', borderRadius: 'var(--rad-md)',
                      border: `1px solid ${selected?.id === c.id ? 'var(--fg-brand)' : 'var(--border)'}`,
                      background: selected?.id === c.id ? 'var(--bg-sunken)' : 'var(--bg-elevated)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--rad-sm)', background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-brand)', flexShrink: 0 }}>
                      <Icon name={kindIcon(c.kind)} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{kindLabel(c.kind)}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{c.mac} · {c.ip}{c.port ? `:${c.port}` : ''}</div>
                    </div>
                    <Badge label={`fw ${c.firmware_version}`} tone="neutral" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual IP fallback */}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer', userSelect: 'none' }}>
              Enter IP address manually
            </summary>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <input
                value={manualIp}
                onChange={e => setManualIp(e.target.value)}
                placeholder="192.168.1.x"
                style={{
                  flex: 1, padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13,
                  border: '1px solid var(--border)', borderRadius: 'var(--rad-sm)',
                  background: 'var(--bg)', color: 'var(--fg)',
                }}
              />
              <button
                onClick={() => { setSelected(null); setStep('code') }}
                disabled={!manualIp.trim()}
                style={{ ...primaryBtnStyle, opacity: manualIp.trim() ? 1 : 0.4 }}
              >
                Next
              </button>
            </div>
          </details>
        </div>
      ) : (
        <div>
          {/* Back link */}
          <button onClick={() => { setStep('scan'); setCode('') }} style={{ ...secondaryBtnStyle, marginBottom: 20, fontSize: 12 }}>
            ← Back
          </button>

          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--rad-md)', background: 'var(--bg-sunken)', marginBottom: 20 }}>
              <Icon name={kindIcon(selected.kind)} size={16} style={{ color: 'var(--fg-brand)' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>{kindLabel(selected.kind)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>{selected.mac}</span>
            </div>
          ) : (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--rad-md)', background: 'var(--bg-sunken)', marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {manualIp}
            </div>
          )}

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Enter the 6-digit pairing code shown on the device's screen or in the mock console.
          </p>

          <input
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter') handlePair() }}
            placeholder="000000"
            maxLength={6}
            style={{
              width: '100%', padding: '14px 16px', marginBottom: 20,
              fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: '0.3em',
              textAlign: 'center', border: '1px solid var(--border)',
              borderRadius: 'var(--rad-md)', background: 'var(--bg)', color: 'var(--fg)',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button onClick={handlePair} disabled={pairing || code.length !== 6} style={{ ...primaryBtnStyle, opacity: (pairing || code.length !== 6) ? 0.5 : 1 }}>
              {pairing ? 'Pairing…' : 'Pair device'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function DeviceScreen() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState<string | null>(null)
  const [unpairTarget, setUnpairTarget] = useState<Device | null>(null)
  const [unpairing, setUnpairing] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.devices.list()
      setDevices(d)
    } catch {
      toast('Could not load devices', 'bad')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 15 s
  useEffect(() => {
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load])

  async function handleRestart(id: string) {
    setRestarting(id)
    try {
      await api.devices.restart(id)
      toast('Restart command sent — device will reboot in a moment', 'good')
      setTimeout(load, 5000)
    } catch {
      toast('Could not send restart command', 'bad')
    } finally {
      setRestarting(null)
    }
  }

  async function handleClearError(id: string) {
    try {
      const updated = await api.devices.clearError(id)
      setDevices(prev => prev.map(d => d.id === id ? updated : d))
      toast('Error cleared', 'good')
    } catch {
      toast('Could not clear error', 'bad')
    }
  }

  async function handleUnpair() {
    if (!unpairTarget) return
    setUnpairing(true)
    try {
      await api.devices.unpair(unpairTarget.id)
      toast(`${unpairTarget.name} unpaired`, 'good')
      setUnpairTarget(null)
      load()
    } catch {
      toast('Could not unpair device', 'bad')
    } finally {
      setUnpairing(false)
    }
  }

  const hub   = devices.find(d => d.kind === 'hub')
  const sense = devices.find(d => d.kind === 'sense')
  const valve = devices.find(d => d.kind === 'valve')

  const allHealthy   = devices.length > 0 && devices.every(d => d.status === 'online' && !d.error_flag)
  const offlineCount = devices.filter(d => d.status === 'offline').length

  let summaryLine = 'Loading…'
  if (!loading) {
    if (devices.length === 0) summaryLine = 'No devices registered yet.'
    else if (allHealthy) summaryLine = `${devices.length} device${devices.length > 1 ? 's' : ''}. All healthy.`
    else if (offlineCount === devices.length) summaryLine = 'All devices are offline. Check WiFi and power.'
    else if (offlineCount > 0) summaryLine = `${offlineCount} device${offlineCount > 1 ? 's are' : ' is'} offline.`
    else summaryLine = 'One or more devices need attention.'
  }

  return (
    <div style={{ padding: '28px 28px 48px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
          Your Sierra system
        </div>
        <h1 style={{ marginBottom: 6 }}>Devices</h1>
        <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>{summaryLine}</p>
      </div>

      {/* Actions bar */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={load} style={{ ...secondaryBtnStyle, fontSize: 13 }}>
          <Icon name="refresh" size={13} />
          Refresh
        </button>
        <button onClick={() => setShowPairModal(true)} style={primaryBtnStyle}>
          <Icon name="plus" size={14} />
          Add device
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <HubCard device={hub} />
          <LocationCard />
          <SenseCard device={sense} onRestart={handleRestart} onClearError={handleClearError} onUnpair={d => { const dev = devices.find(x => x.id === d); if (dev) setUnpairTarget(dev) }} restarting={restarting} onAddDevice={() => setShowPairModal(true)} />
          <ValveCard device={valve} onRestart={handleRestart} onClearError={handleClearError} onUnpair={d => { const dev = devices.find(x => x.id === d); if (dev) setUnpairTarget(dev) }} restarting={restarting} onAddDevice={() => setShowPairModal(true)} />
        </div>
      )}

      {/* Pair modal */}
      {showPairModal && (
        <PairModal onClose={() => setShowPairModal(false)} onPaired={load} />
      )}

      {/* Unpair confirmation modal */}
      {unpairTarget && (
        <Modal title={`Unpair ${unpairTarget.name}?`} onClose={() => setUnpairTarget(null)} width={420}>
          <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            This will revoke the device's credentials. It will go back to the unprovisioned state. You'll need to re-pair it from scratch.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setUnpairTarget(null)} style={secondaryBtnStyle}>Keep it</button>
            <button
              onClick={handleUnpair}
              disabled={unpairing}
              style={{
                padding: '8px 18px', background: 'var(--clay-500)', color: '#fff',
                border: 'none', borderRadius: 'var(--rad-sm)', fontFamily: 'var(--font-sans)',
                fontSize: 13, fontWeight: 600, cursor: unpairing ? 'not-allowed' : 'pointer',
              }}
            >
              {unpairing ? 'Unpairing…' : 'Unpair'}
            </button>
          </div>
        </Modal>
      )}

      {/* CSS for status dot pulse animation */}
      <style>{`
        @keyframes pulse {
          from { transform: scale(1); opacity: 0.4; }
          to   { transform: scale(1.9); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
