import { useState, useCallback, useEffect, useRef } from 'react'
import { Icon } from './Icon'

type ToastItem = { id: number; message: string; tone: 'good' | 'bad' }

let _show: ((msg: string, tone: 'good' | 'bad') => void) | null = null

export function toast(message: string, tone: 'good' | 'bad' = 'good') {
  _show?.(message, tone)
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, tone: 'good' | 'bad') => {
    const id = ++counter.current
    setItems(prev => [...prev, { id, message, tone }])
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3200)
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
          animation: 'slideIn 180ms var(--ease-standard)',
        }}>
          <Icon name={t.tone === 'good' ? 'check' : 'warn'} size={15} />
          {t.message}
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
