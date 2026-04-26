// All readings/runs/alerts are stored UTC in the backend. The viewer should
// see them in the *hub's* timezone (the garden's clock), regardless of which
// device they're using. setHubTimezone is called once at app boot from the
// /api/settings/location response.
let HUB_TZ: string = Intl.DateTimeFormat().resolvedOptions().timeZone
const LOCALE = 'en-GB'

export function setHubTimezone(tz: string | undefined | null): void {
  if (tz && typeof tz === 'string') HUB_TZ = tz
}

export function getHubTimezone(): string {
  return HUB_TZ
}

export function fmtHHMM(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: HUB_TZ })
}

export function fmtRelative(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return fmtHHMM(d)
  if (diffDays === 1) return `Yesterday ${fmtHHMM(d)}`
  return d.toLocaleDateString(LOCALE, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: HUB_TZ })
}

export function fmtTodayLong(d: Date = new Date()): string {
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: HUB_TZ })
}

// Used by the sparkline X-axis. Picks ~5 evenly spaced labels from the
// timestamp range so the legend reflects the actual data window.
export function spreadAxisLabels(timestamps: string[], buckets = 5): string[] {
  if (timestamps.length < 2) return []
  const first = new Date(timestamps[0]).getTime()
  const last = new Date(timestamps[timestamps.length - 1]).getTime()
  const step = (last - first) / (buckets - 1)
  const labels: string[] = []
  for (let i = 0; i < buckets - 1; i++) {
    labels.push(fmtHHMM(new Date(first + step * i)))
  }
  labels.push('now')
  return labels
}
