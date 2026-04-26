// Sierra is a hub product: timestamps come from the broker as UTC and we
// always render them in the hub's local timezone (Europe/Rome). Hardcoding
// the IANA zone keeps tooltips correct when the user opens the UI from a
// laptop or phone configured for a different region.
const TZ = 'Europe/Rome'
const LOCALE = 'en-GB'

export function fmtHHMM(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

export function fmtRelative(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return fmtHHMM(d)
  if (diffDays === 1) return `Yesterday ${fmtHHMM(d)}`
  return d.toLocaleDateString(LOCALE, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

export function fmtTodayLong(d: Date = new Date()): string {
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
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
