type Props = {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: Props) {
  return (
    <span
      className="skeleton"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        padding: 20,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--rad-lg)',
        height,
      }}
    >
      <Skeleton width={90} height={10} style={{ marginBottom: 12 }} />
      <Skeleton width="70%" height={28} style={{ marginBottom: 10 }} />
      <Skeleton width="40%" height={11} />
    </div>
  )
}
