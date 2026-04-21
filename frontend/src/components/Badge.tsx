type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

const toneStyles: Record<Tone, { bg: string; color: string; dot: string }> = {
  good:    { bg: 'var(--mist-500)',    color: 'var(--moss-700)', dot: 'var(--state-good)' },
  warn:    { bg: 'var(--amber-100)',   color: '#805821',         dot: 'var(--state-warn)' },
  bad:     { bg: 'var(--clay-100)',    color: 'var(--clay-500)', dot: 'var(--state-bad)' },
  info:    { bg: 'var(--water-100)',   color: '#2F5866',         dot: 'var(--state-info)' },
  neutral: { bg: 'var(--stone-100)',   color: 'var(--fg-muted)', dot: 'var(--stone-400)' },
}

type Props = {
  label: string
  tone?: Tone
  dot?: boolean
}

export function Badge({ label, tone = 'neutral', dot = true }: Props) {
  const s = toneStyles[tone]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 999,
      background: s.bg,
      color: s.color,
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      fontWeight: 600,
    }}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.dot,
          flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  )
}
