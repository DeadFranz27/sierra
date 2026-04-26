import type { ReactNode } from 'react'
import type { IconName } from './Icon'
import { Icon } from './Icon'

type Props = {
  label: string
  value: string | number | ReactNode
  unit?: string
  sub?: string
  tone?: string
  icon?: IconName
}

export function Stat({ label, value, unit, sub, tone, icon }: Props) {
  return (
    <div
      className="lift fade-in-up"
      style={{
        padding: 18,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        {icon && (
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'var(--bg-sunken)', color: 'var(--fg-brand)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name={icon} size={13} />
          </span>
        )}
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--fg-muted)',
        }}>{label}</div>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 34,
        letterSpacing: '-0.03em',
        color: tone ?? 'var(--fg-brand)',
        lineHeight: 1,
        wordBreak: 'break-word',
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
