import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export function Modal({ title, onClose, children, width = 480 }: Props) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    if (closing) return
    setClosing(true)
    // Match the exit animation duration below.
    setTimeout(onClose, 160)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Portal to document.body so the modal escapes any ancestor that creates
  // a containing block for `position: fixed` (transforms, filters, etc.)
  // — e.g. the `fade-in-up` page wrapper in Layout.
  return createPortal((
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(27,25,21,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
        animation: closing ? 'fadeIn 160ms var(--ease-standard) reverse forwards' : 'fadeIn 160ms var(--ease-standard)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: 'var(--elev-3)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          animation: closing
            ? 'modalPop 160ms var(--ease-standard) reverse forwards'
            : 'modalPop 220ms var(--ease-standard)',
          transformOrigin: 'center',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, color: 'var(--fg)',
          }}>{title}</div>
          <button
            onClick={handleClose}
            className="icon-btn"
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fg-muted)',
            }}
          ><Icon name="x" size={15} /></button>
        </div>
        <div style={{ padding: '22px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  ), document.body)
}
