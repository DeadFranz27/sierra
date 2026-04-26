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
  onRename: (device: Device) => void
  onFactoryReset: (device: Device) => void
  onReprovisionWifi: (device: Device) => void
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

function SenseCard({ device, onRestart, onClearError, onUnpair, onRename, onFactoryReset, onReprovisionWifi, restarting, onAddDevice }: DeviceCardProps) {
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
      <CardHeader
        icon="activity"
        title={device.name || 'Sierra Sense'}
        subtitle={`ESP32 · ${device.ip_address ?? '—'}`}
        tone={tone}
        statusLabel={statusLabel(device)}
        onRename={() => onRename(device)}
      />
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
        onUnpair={onUnpair}
        onReprovisionWifi={() => onReprovisionWifi(device)}
        onFactoryReset={() => onFactoryReset(device)}
      />
    </div>
  )
}

function ValveCard({ device, onRestart, onClearError, onUnpair, onRename, onFactoryReset, onReprovisionWifi, restarting, onAddDevice }: DeviceCardProps) {
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
      <CardHeader
        icon="droplet"
        title={device.name || 'Sierra Valve'}
        subtitle={`ESP32 · ${device.ip_address ?? '—'}`}
        tone={tone}
        statusLabel={statusLabel(device)}
        onRename={() => onRename(device)}
      />
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
        onReprovisionWifi={() => onReprovisionWifi(device)}
        onFactoryReset={() => onFactoryReset(device)}
      />
    </div>
  )
}

// ─── sub-components ─────────────────────────────────────────────────────────

function CardHeader({ icon, title, subtitle, tone, statusLabel, onRename }: { icon: IconName; title: string; subtitle: string; tone: 'good' | 'warn' | 'bad' | 'neutral'; statusLabel: string; onRename?: () => void }) {
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
          {onRename && (
            <button
              onClick={onRename}
              title="Rename"
              aria-label="Rename device"
              style={{
                background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center',
                borderRadius: 'var(--rad-sm)',
              }}
            >
              <Icon name="edit" size={13} />
            </button>
          )}
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

function CardActions({ deviceId, tone, hasError, restarting, onRestart, onClearError, onUnpair, onReprovisionWifi, onFactoryReset }: {
  deviceId: string; tone: string; hasError: boolean; restarting: string | null
  onRestart: (id: string) => void
  onClearError: (id: string) => void
  onUnpair?: (id: string) => void
  onReprovisionWifi?: () => void
  onFactoryReset?: () => void
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
      {onReprovisionWifi && (
        <button onClick={onReprovisionWifi} style={secondaryBtnStyle}>
          <Icon name="wifiOff" size={13} />
          Wi-Fi setup
        </button>
      )}
      {onUnpair && (
        <button onClick={() => onUnpair(deviceId)} style={{ ...secondaryBtnStyle, color: 'var(--clay-500)', borderColor: 'var(--clay-300)' }}>
          <Icon name="unlink" size={13} />
          Unpair
        </button>
      )}
      {onFactoryReset && (
        <button onClick={onFactoryReset} style={{ ...secondaryBtnStyle, color: 'var(--clay-500)', borderColor: 'var(--clay-300)' }}>
          <Icon name="trash" size={13} />
          Factory reset
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
//
// Zero-touch (TOFU) flow: devices in PAIRING state announce themselves to
// the hub every few seconds. The modal polls /candidates and renders each
// one as a single-click pair card — no shared secret to type.
//
// Manual IP is still offered as a fallback for devices that can't reach
// sierra-hub.local (e.g. mDNS broken on the network); that path keeps the
// 6-digit code requirement so we don't trust a bare IP blindly.

function PairModal({ onClose, onPaired }: { onClose: () => void; onPaired: () => void }) {
  const [candidates, setCandidates] = useState<DeviceCandidate[]>([])
  const [scanning, setScanning] = useState(true)
  const [pairingId, setPairingId] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualIp, setManualIp] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scan = useCallback(async () => {
    try {
      const res = await api.devices.candidates()
      setCandidates(res)
    } catch {
      // silent — backend may be momentarily unreachable
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    scan()
    pollRef.current = setInterval(scan, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [scan])

  async function pairCandidate(c: DeviceCandidate) {
    setPairingId(c.id)
    try {
      await api.devices.pair({ device_id: c.id })
      toast(`${kindLabel(c.kind)} paired`, 'good')
      onPaired()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pairing failed'
      const friendly =
        msg.includes('409') ? 'Device already paired' :
        msg.includes('410') ? 'Device went quiet — wait a few seconds and try again' :
        msg.includes('502') ? 'Could not reach the device — make sure it is still on Wi-Fi' :
        'Pairing failed — please try again'
      toast(friendly, 'bad')
      // Refresh list so a stale or just-claimed candidate disappears.
      scan()
    } finally {
      setPairingId(null)
    }
  }

  async function pairManual() {
    const ip = manualIp.trim()
    const code = manualCode.trim()
    if (!ip) { toast('Enter the device IP', 'bad'); return }
    if (code.length !== 6) { toast('Enter the 6-digit code', 'bad'); return }
    setManualBusy(true)
    try {
      await api.devices.pair({ ip, pairing_code: code })
      toast('Device paired', 'good')
      onPaired()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pairing failed'
      const friendly =
        msg.includes('403') ? 'Wrong pairing code' :
        msg.includes('409') ? 'Device already paired' :
        msg.includes('502') ? 'Could not reach the device at that IP' :
        'Pairing failed — please try again'
      toast(friendly, 'bad')
    } finally {
      setManualBusy(false)
    }
  }

  const kindLabel = (k: string) => k === 'sense' ? 'Sierra Sense' : k === 'valve' ? 'Sierra Valve' : k
  const kindIcon = (k: string): IconName => k === 'sense' ? 'activity' : 'droplet'
  const kindSubtitle = (k: string) =>
    k === 'sense' ? 'Soil moisture sensor' :
    k === 'valve' ? 'Water valve actuator' : ''

  return (
    <Modal title="Add a device" onClose={onClose} width={480}>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Power on a Sierra device and connect it to your Wi-Fi. It will appear here automatically — tap to pair.
      </p>

      {/* Eyebrow + live discovery indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 'var(--tracking-eyebrow)',
          color: 'var(--fg-muted)',
        }}>
          On your network
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: 'var(--moss-500)',
            animation: 'pair-pulse 1.4s var(--ease-standard) infinite',
          }} />
          Listening
        </div>
      </div>

      {candidates.length === 0 ? (
        <div style={{
          padding: '28px 18px', borderRadius: 'var(--rad-md)',
          border: '1px dashed var(--border)', textAlign: 'center',
          background: 'var(--bg-sunken)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--fg)', marginBottom: 6 }}>
            {scanning ? 'Looking for devices…' : 'Nothing found yet'}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
            New devices appear within a few seconds of joining your Wi-Fi. The blinking LED on the device means it's looking for the hub.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {candidates.map(c => {
            const busy = pairingId === c.id
            const disabled = pairingId !== null
            return (
              <button
                key={c.id}
                onClick={() => pairCandidate(c)}
                disabled={disabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 'var(--rad-md)',
                  border: '1px solid var(--moss-200)',
                  background: busy ? 'var(--mist-300)' : 'var(--bg-elevated)',
                  cursor: disabled ? 'wait' : 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)',
                  opacity: disabled && !busy ? 0.5 : 1,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--rad-sm)',
                  background: 'var(--bg-sunken)', color: 'var(--fg-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={kindIcon(c.kind)} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--fg-brand)', lineHeight: 1.2 }}>
                    {kindLabel(c.kind)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {kindSubtitle(c.kind)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', marginTop: 4 }}>
                    {c.mac} · {c.ip} · fw {c.firmware_version}
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
                  color: busy ? 'var(--fg-muted)' : 'var(--fg-brand)', flexShrink: 0,
                }}>
                  {busy ? 'Pairing…' : 'Pair →'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Manual IP fallback — kept inside the same modal but hidden by default */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {!manualOpen ? (
          <button
            onClick={() => setManualOpen(true)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Don't see your device? Pair manually by IP
          </button>
        ) : (
          <div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 'var(--tracking-eyebrow)',
              color: 'var(--fg-muted)', marginBottom: 10,
            }}>
              Manual pairing
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Use this if the hub can't auto-discover the device. Find the device IP from your router and the 6-digit code on the device's serial console.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={manualIp}
                onChange={e => setManualIp(e.target.value)}
                placeholder="Device IP — e.g. 192.168.1.42"
                style={{
                  width: '100%', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13,
                  border: '1px solid var(--border)', borderRadius: 'var(--rad-sm)',
                  background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box',
                }}
              />
              <input
                value={manualCode}
                onChange={e => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => { if (e.key === 'Enter') pairManual() }}
                placeholder="000000"
                maxLength={6}
                style={{
                  width: '100%', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 18,
                  letterSpacing: '0.25em', textAlign: 'center',
                  border: '1px solid var(--border)', borderRadius: 'var(--rad-sm)',
                  background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => { setManualOpen(false); setManualIp(''); setManualCode('') }} style={secondaryBtnStyle}>Cancel</button>
                <button
                  onClick={pairManual}
                  disabled={manualBusy || !manualIp.trim() || manualCode.length !== 6}
                  style={{ ...primaryBtnStyle, opacity: (manualBusy || !manualIp.trim() || manualCode.length !== 6) ? 0.5 : 1 }}
                >
                  {manualBusy ? 'Pairing…' : 'Pair'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pair-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
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
  const [renameTarget, setRenameTarget] = useState<Device | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [factoryResetTarget, setFactoryResetTarget] = useState<Device | null>(null)
  const [factoryResetting, setFactoryResetting] = useState(false)
  const [reprovisionTarget, setReprovisionTarget] = useState<Device | null>(null)
  const [reprovisioning, setReprovisioning] = useState(false)

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

  function openRename(device: Device) {
    setRenameValue(device.name)
    setRenameTarget(device)
  }

  async function handleRename() {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) { toast('Name cannot be empty', 'bad'); return }
    if (name === renameTarget.name) { setRenameTarget(null); return }
    setRenaming(true)
    try {
      const updated = await api.devices.update(renameTarget.id, { name })
      setDevices(prev => prev.map(d => d.id === updated.id ? updated : d))
      toast('Renamed', 'good')
      setRenameTarget(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not rename'
      toast(msg.includes('422') ? 'Invalid name' : 'Could not rename', 'bad')
    } finally {
      setRenaming(false)
    }
  }

  async function handleFactoryReset() {
    if (!factoryResetTarget) return
    setFactoryResetting(true)
    try {
      await api.devices.factoryReset(factoryResetTarget.id)
      toast(`${factoryResetTarget.name} factory reset — it will reboot unprovisioned`, 'good')
      setFactoryResetTarget(null)
      load()
    } catch {
      toast('Could not factory reset', 'bad')
    } finally {
      setFactoryResetting(false)
    }
  }

  async function handleReprovisionWifi() {
    if (!reprovisionTarget) return
    setReprovisioning(true)
    try {
      await api.devices.reprovisionWifi(reprovisionTarget.id)
      toast(`${reprovisionTarget.name} will restart in Wi-Fi setup mode`, 'good')
      setReprovisionTarget(null)
      load()
    } catch {
      toast('Could not start Wi-Fi setup', 'bad')
    } finally {
      setReprovisioning(false)
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
          <SenseCard
            device={sense}
            onRestart={handleRestart}
            onClearError={handleClearError}
            onUnpair={d => { const dev = devices.find(x => x.id === d); if (dev) setUnpairTarget(dev) }}
            onRename={openRename}
            onFactoryReset={d => setFactoryResetTarget(d)}
            onReprovisionWifi={d => setReprovisionTarget(d)}
            restarting={restarting}
            onAddDevice={() => setShowPairModal(true)}
          />
          <ValveCard
            device={valve}
            onRestart={handleRestart}
            onClearError={handleClearError}
            onUnpair={d => { const dev = devices.find(x => x.id === d); if (dev) setUnpairTarget(dev) }}
            onRename={openRename}
            onFactoryReset={d => setFactoryResetTarget(d)}
            onReprovisionWifi={d => setReprovisionTarget(d)}
            restarting={restarting}
            onAddDevice={() => setShowPairModal(true)}
          />
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

      {/* Rename modal */}
      {renameTarget && (
        <Modal title={`Rename ${renameTarget.name}`} onClose={() => setRenameTarget(null)} width={420}>
          <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Pick a name that helps you tell devices apart — e.g. "Greenhouse Sense" or "Patio Valve".
          </p>
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value.slice(0, 64))}
            onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
            placeholder="Device name"
            maxLength={64}
            style={{
              width: '100%', padding: '10px 12px', fontFamily: 'var(--font-sans)', fontSize: 14,
              border: '1px solid var(--border)', borderRadius: 'var(--rad-sm)',
              background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', marginBottom: 20,
            }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setRenameTarget(null)} style={secondaryBtnStyle}>Cancel</button>
            <button
              onClick={handleRename}
              disabled={renaming || !renameValue.trim()}
              style={{ ...primaryBtnStyle, opacity: (renaming || !renameValue.trim()) ? 0.5 : 1 }}
            >
              {renaming ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Wi-Fi reprovision confirmation */}
      {reprovisionTarget && (
        <Modal title={`Wi-Fi setup for ${reprovisionTarget.name}?`} onClose={() => setReprovisionTarget(null)} width={420}>
          <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            The device will reboot and come back as a Wi-Fi access point so you can join it from your phone and pick a new network. Pairing credentials are kept — no need to re-pair.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setReprovisionTarget(null)} style={secondaryBtnStyle}>Cancel</button>
            <button
              onClick={handleReprovisionWifi}
              disabled={reprovisioning}
              style={{ ...primaryBtnStyle, opacity: reprovisioning ? 0.6 : 1 }}
            >
              {reprovisioning ? 'Sending…' : 'Restart for Wi-Fi setup'}
            </button>
          </div>
        </Modal>
      )}

      {/* Factory reset confirmation */}
      {factoryResetTarget && (
        <Modal title={`Factory reset ${factoryResetTarget.name}?`} onClose={() => setFactoryResetTarget(null)} width={440}>
          <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            This wipes all settings on the device — Wi-Fi credentials, pairing, calibration. The device will reboot as a brand-new unit and you'll need to set it up from scratch.
          </p>
          <p style={{ color: 'var(--clay-500)', fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.5, marginBottom: 24 }}>
            This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setFactoryResetTarget(null)} style={secondaryBtnStyle}>Cancel</button>
            <button
              onClick={handleFactoryReset}
              disabled={factoryResetting}
              style={{
                padding: '8px 18px', background: 'var(--clay-500)', color: '#fff',
                border: 'none', borderRadius: 'var(--rad-sm)', fontFamily: 'var(--font-sans)',
                fontSize: 13, fontWeight: 600, cursor: factoryResetting ? 'not-allowed' : 'pointer',
              }}
            >
              {factoryResetting ? 'Resetting…' : 'Factory reset'}
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
