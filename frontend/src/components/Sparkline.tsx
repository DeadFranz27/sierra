import { useEffect, useRef, useState } from 'react'

type Props = {
  data: number[]
  labels?: string[]   // optional per-point label (e.g. timestamp); falls back to index
  color?: string
  height?: number     // total chart height including axes (default: 180 — was 60, way too squashed)
  unit?: string
  showAxes?: boolean  // show Y-axis ticks + horizontal gridlines (default: true)
  yMin?: number       // force a y-axis floor (default: auto from data, padded)
  yMax?: number       // force a y-axis ceiling (default: auto from data, padded)
}

// Smooth a polyline with a Catmull-Rom → cubic Bezier conversion.
// This gives the soft curve feel of a polished chart without overshoot.
function smoothPath(pts: number[][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  const tension = 0.5
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2
    const cp1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2
    const cp2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2
    const cp2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`
  }
  return d
}

export function Sparkline({
  data,
  labels,
  color = 'var(--fern-500)',
  height = 180,
  unit = '%',
  showAxes = true,
  yMin: yMinProp,
  yMax: yMaxProp,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<{ idx: number } | null>(null)

  // Track actual rendered width so the chart uses real coords (not stretched).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.max(120, e.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Animate line draw on first paint and when data length changes.
  useEffect(() => {
    const p = pathRef.current
    if (!p) return
    const len = p.getTotalLength()
    p.style.strokeDasharray = `${len}`
    p.style.strokeDashoffset = `${len}`
    // Reflow to commit styles, then animate.
    void p.getBoundingClientRect()
    p.style.transition = 'stroke-dashoffset 700ms cubic-bezier(.22,.61,.36,1)'
    p.style.strokeDashoffset = '0'
  }, [data.length, width])

  if (data.length < 2) {
    return (
      <div ref={wrapRef} style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
        Not enough data yet
      </div>
    )
  }

  // Geometry — use real pixel coords so SVG isn't stretched.
  const padL = showAxes ? 38 : 6   // room for Y-axis labels
  const padR = 12
  const padT = 14
  const padB = 22                  // room for X-axis labels
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const dataMin = Math.min(...data)
  const dataMax = Math.max(...data)
  const span = dataMax - dataMin
  // Pad the y-axis so the line doesn't kiss the edges; floor/ceiling to
  // sensible-looking ticks. Without this the chart still looks squashed
  // when readings vary by only 1–2 percentage points.
  const pad = span < 5 ? 4 : span * 0.18
  const yMin = yMinProp ?? Math.max(0, Math.floor((dataMin - pad) / 5) * 5)
  const yMax = yMaxProp ?? Math.min(100, Math.ceil((dataMax + pad) / 5) * 5)
  const yRange = Math.max(1, yMax - yMin)

  const xAt = (i: number) => padL + (i / (data.length - 1)) * innerW
  const yAt = (v: number) => padT + (1 - (v - yMin) / yRange) * innerH

  const pts = data.map((v, i) => [xAt(i), yAt(v)])
  const linePath = smoothPath(pts)
  const areaPath = `${linePath} L ${xAt(data.length - 1)} ${padT + innerH} L ${xAt(0)} ${padT + innerH} Z`

  // 4 horizontal gridlines including top & bottom — clean and uncluttered.
  const yTicks = [yMax, yMin + (yRange * 2) / 3, yMin + yRange / 3, yMin]

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = (x - padL) / innerW
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))))
    setHover({ idx })
  }

  const lastIdx = data.length - 1
  const lastPt = pts[lastIdx]
  const hovered = hover ? { idx: hover.idx, x: pts[hover.idx][0], y: pts[hover.idx][1], v: data[hover.idx] } : null
  const tooltipLabel = hover ? (labels?.[hover.idx] ?? `#${hover.idx + 1}`) : ''

  // Tooltip clamping to keep it inside the card.
  const tipX = hovered ? Math.max(8, Math.min(width - 100, hovered.x - 50)) : 0
  const tipY = hovered ? Math.max(2, hovered.y - 42) : 0

  const gradId = `spark-grad-${Math.abs(data.length * 31 + Math.round(width))}`

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y-axis labels */}
        {showAxes && yTicks.map((t, i) => {
          const y = yAt(t)
          return (
            <g key={i}>
              <line
                x1={padL} x2={padL + innerW}
                y1={y} y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={i === yTicks.length - 1 ? undefined : '3 4'}
              />
              <text
                x={padL - 8} y={y + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--fg-muted)"
              >{Math.round(t)}{unit}</text>
            </g>
          )
        })}

        {/* Filled area under the line */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* The line itself, animated on draw */}
        <path
          ref={pathRef}
          d={linePath}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Endpoint dot (latest reading) */}
        <circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={color} />
        <circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={color} opacity="0.3">
          <animate attributeName="r" from="4" to="9" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
        </circle>

        {/* Hover crosshair + dot */}
        {hovered && (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={hovered.x} x2={hovered.x}
              y1={padT} y2={padT + innerH}
              stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
            />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--bg-elevated)" stroke={color} strokeWidth={2} />
          </g>
        )}

        {/* X-axis labels — first, middle, last */}
        {showAxes && labels && labels.length > 1 && (
          <g>
            {[0, Math.floor(data.length / 2), data.length - 1].map((i, k) => (
              <text
                key={k}
                x={xAt(i)}
                y={height - 6}
                textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--fg-muted)"
              >{labels[i]}</text>
            ))}
          </g>
        )}
      </svg>

      {hovered && (
        <div style={{
          position: 'absolute',
          left: tipX,
          top: tipY,
          background: 'var(--moss-900)',
          color: '#fff',
          padding: '5px 9px',
          borderRadius: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: 'var(--elev-2)',
          animation: 'fadeIn 120ms var(--ease-standard) both',
        }}>
          <span style={{ opacity: 0.7, fontFamily: 'var(--font-sans)', fontSize: 11, marginRight: 4 }}>{tooltipLabel}</span>
          <b>{hovered.v.toFixed(1)}{unit}</b>
        </div>
      )}
    </div>
  )
}
