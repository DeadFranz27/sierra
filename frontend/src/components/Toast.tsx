import { useState, useCallback, useEffect, useRef } from 'react'
import { Icon } from './Icon'

type ToastItem = { id: number; message: string; tone: 'good' | 'bad'; leaving?: boolean }

let _show: ((msg: string, tone: 'good' | 'bad') => void) | null = null

export function toast(message: string, tone: 'good' | 'bad' = 'good') {
  _show?.(message, tone)
}

const LIFE_MS = 3000
const EXIT_MS = 220

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, tone: 'good' | 'bad') => {
    const id = ++counter.current
    setItems(prev => [...prev, { id, message, tone }])
    setTimeout(() => setItems(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t)), LIFE_MS)
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), LIFE_MS + EXIT_MS)
  }, [])

  useEffect(() => { _show = show; return () => { _show = null } }, [show])

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 10,
      zIndex: 2000, pointerEvents: 'none',
    }}>
      {items.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: t.tone === 'good' ? 'var(--moss-900)' : 'var(--clay-500)',
          color: '#fff',
          borderRadius: 12,
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
          boxShadow: 'var(--elev-3)',
          pointerEvents: 'auto',
          animation: t.leaving
            ? 'toastOut 220ms var(--ease-standard) forwards'
            : 'toastIn 280ms var(--ease-standard)',
          transformOrigin: 'right center',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(255,255,255,.16)', flexShrink: 0,
          }}>
            <Icon name={t.tone === 'good' ? 'check' : 'warn'} size={13} />
          </span>
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          0%   { opacity: 0; transform: translateX(20px) scale(.92); }
          60%  { opacity: 1; transform: translateX(-2px) scale(1.01); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(16px) scale(.96); }
        }
      `}</style>
    </div>
  )
}
