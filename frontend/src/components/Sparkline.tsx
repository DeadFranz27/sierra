import { useRef, useState } from 'react'

type Props = {
  data: number[]
  labels?: string[]   // optional per-point label (e.g. timestamp); falls back to index
  color?: string
  height?: number
  unit?: string
}

export function Sparkline({ data, labels, color = 'var(--fern-500)', height = 44, unit = '%' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ x: number; y: number; value: number; label: string } | null>(null)

  if (data.length < 2) return null

  const W = 240
  const H = height
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data.map((v, i) => [
    i * (W / (data.length - 1)),
    H - ((v - min) / (max - min || 1)) * (H - 8) - 4,
  ])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width  // 0..1
    const idx = Math.round(relX * (data.length - 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    const [px, py] = pts[clamped]
    // convert SVG coords back to screen %
    const screenX = (px / W) * rect.width
    setHover({
      x: screenX,
      y: py,
      value: data[clamped],
      label: labels?.[clamped] ?? `#${clamped + 1}`,
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={color} opacity="0.12" />
        <path d={d} stroke={color} strokeWidth="1.6" fill="none" />
        {hover && (() => {
          const idx = labels ? labels.indexOf(hover.label) : -1
          const svgX = idx >= 0 ? pts[idx][0] : pts[Math.round((hover.x / W) * (data.length - 1))]?.[0] ?? hover.x
          const svgY = pts[data.indexOf(hover.value)]?.[1] ?? hover.y
          // find the actual point
          const closestPt = pts.find(p => Math.abs(p[0] - svgX) < 2) ?? [svgX, svgY]
          return (
            <>
              <line x1={closestPt[0]} y1={0} x2={closestPt[0]} y2={H} stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
              <circle cx={closestPt[0]} cy={closestPt[1]} r="3.5" fill={color} />
            </>
          )
        })()}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute',
          top: Math.max(0, hover.y - 32),
          left: Math.min(hover.x + 8, 999),
          transform: hover.x > W * 0.7 ? 'translateX(calc(-100% - 16px))' : undefined,
          background: 'var(--moss-900)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: 'var(--elev-2, 0 2px 8px rgba(0,0,0,.2))',
        }}>
          <span style={{ opacity: 0.7, fontFamily: 'var(--font-sans)', fontSize: 11 }}>{hover.label} </span>
          <b>{hover.value.toFixed(1)}{unit}</b>
        </div>
      )}
    </div>
  )
}
