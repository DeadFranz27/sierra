type Props = {
  label: string
  value: string | number
  unit?: string
  sub?: string
  tone?: string
}

export function Stat({ label, value, unit, sub, tone }: Props) {
  return (
    <div style={{
      padding: 18,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 14,
    }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--fg-muted)',
        marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 34,
        letterSpacing: '-0.03em',
        color: tone ?? 'var(--fg-brand)',
        lineHeight: 1,
      }}>
        {value}
        {unit && (
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            color: 'var(--fg-muted)',
            marginLeft: 3,
          }}>{unit}</span>
        )}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--fg-muted)',
          marginTop: 8,
        }}>{sub}</div>
      )}
    </div>
  )
}
