import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

type Props = {
  eyebrow?: string
  title: string
  icon?: IconName
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, icon, actions }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12, fontWeight: 600,
            letterSpacing: '.12em', textTransform: 'uppercase',
            color: 'var(--fg-muted)', marginBottom: 6,
          }}>{eyebrow}</div>
        )}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 40,
          color: 'var(--fg-brand)',
          margin: 0,
          letterSpacing: '-0.02em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          lineHeight: 1.1,
        }}>
          {icon && (
            <span style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--mist-300)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fg-brand)',
              flexShrink: 0,
            }}>
              <Icon name={icon} size={22} />
            </span>
          )}
          {title}
        </h1>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
