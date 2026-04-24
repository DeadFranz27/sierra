import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'

type Props = {
  demoMode: boolean
  onAccountCreated: () => void
  onUseDemo: () => void
}

const USERNAME_RE = /^[a-zA-Z0-9._-]+$/

function validateUsername(v: string): string {
  if (!v.trim()) return 'Scegli uno username'
  if (v.length < 3) return 'Almeno 3 caratteri'
  if (v.length > 64) return 'Massimo 64 caratteri'
  if (!USERNAME_RE.test(v)) return 'Solo lettere, numeri, punto, trattino, underscore'
  return ''
}

function validatePassword(v: string): string {
  if (v.length < 8) return 'Almeno 8 caratteri'
  if (!/[A-Za-z]/.test(v)) return 'Almeno una lettera'
  if (!/\d/.test(v)) return 'Almeno un numero'
  return ''
}

export function CreateAccountStep({ demoMode, onAccountCreated, onUseDemo }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usingDemo, setUsingDemo] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string; confirm?: string }>({})

  function validate(): boolean {
    const errs: typeof fieldErrors = {}
    const u = validateUsername(username)
    if (u) errs.username = u
    const p = validatePassword(password)
    if (p) errs.password = p
    if (confirm !== password) errs.confirm = 'Le password non coincidono'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      await api.auth.setup(username.trim(), password)
      onAccountCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore durante la creazione'
      if (msg.toLowerCase().includes('taken')) {
        setFieldErrors({ username: 'Username già in uso' })
      } else {
        setError(msg)
      }
      setSaving(false)
    }
  }

  async function handleUseDemo() {
    setError('')
    setUsingDemo(true)
    try {
      await api.auth.login('demo', 'sierra2024')
      onUseDemo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile accedere come demo')
      setUsingDemo(false)
    }
  }

  return (
    <div>
      <style>{`
        @keyframes sierra-acct-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .acct-1 { animation: sierra-acct-in var(--dur-emphasis) var(--ease-standard) both; }
        .acct-2 { animation: sierra-acct-in var(--dur-emphasis) var(--ease-standard) 100ms both; }
        .acct-3 { animation: sierra-acct-in var(--dur-emphasis) var(--ease-standard) 220ms both; }
        .acct-4 { animation: sierra-acct-in var(--dur-emphasis) var(--ease-standard) 340ms both; }
        .acct-5 { animation: sierra-acct-in var(--dur-emphasis) var(--ease-standard) 460ms both; }

        .acct-input {
          width: 100%;
          padding: 12px 14px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--rad-sm);
          font-family: var(--font-sans);
          font-size: var(--text-base);
          color: var(--fg);
          outline: none;
          transition: border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard);
        }
        .acct-input:focus { border-color: var(--border-focus); box-shadow: var(--focus-ring); }
        .acct-input.err { border-color: var(--clay-500); }

        .acct-label {
          display: block;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--fg-muted);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: var(--tracking-eyebrow);
        }

        .acct-hint {
          margin-top: 6px;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--fg-subtle);
        }

        .acct-field-error {
          margin-top: 6px;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--state-bad);
        }

        .acct-pw-wrap { position: relative; }
        .acct-pw-toggle {
          position: absolute;
          right: 10px; top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--fg-muted);
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 600;
          cursor: pointer;
          padding: 4px 6px;
        }
        .acct-pw-toggle:hover { color: var(--fg); }

        .acct-primary {
          padding: 11px 24px;
          background: var(--fg-brand);
          color: #fff;
          border: none;
          border-radius: var(--rad-pill);
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: var(--text-sm);
          cursor: pointer;
          box-shadow: var(--elev-1);
          transition: all var(--dur-base) var(--ease-standard);
        }
        .acct-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--elev-2); }
        .acct-primary:active { background: var(--accent-press); transform: translateY(0); }
        .acct-primary:disabled { background: var(--moss-400); cursor: not-allowed; transform: none; box-shadow: none; }

        .acct-demo-btn {
          background: transparent;
          border: none;
          color: var(--fg-link);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          padding: 4px 6px;
        }
        .acct-demo-btn:disabled { opacity: .6; cursor: not-allowed; }

        .acct-demo-banner {
          padding: 12px 14px;
          background: var(--mist-300);
          border: 1px solid var(--moss-200);
          border-radius: var(--rad-sm);
          font-size: var(--text-sm);
          color: var(--moss-700);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
      `}</style>

      <div className="eyebrow acct-1" style={{ marginBottom: 12, textAlign: 'center' }}>
        Il primo passo
      </div>

      <h2
        className="acct-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          lineHeight: 'var(--lh-snug)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--fg-brand)',
          marginBottom: 14,
          textAlign: 'center',
        }}
      >
        Crea il tuo accesso.
      </h2>

      <p className="lead acct-2" style={{ marginBottom: 24, textAlign: 'center' }}>
        Username e password resteranno sul tuo hub. Nessuno li vede all'esterno.
      </p>

      {demoMode && (
        <div className="acct-demo-banner acct-2" style={{ marginBottom: 20 }}>
          <span>
            Puoi anche provare subito con l'account demo (<span className="mono">demo</span> / <span className="mono">sierra2024</span>).
          </span>
          <button
            type="button"
            className="acct-demo-btn"
            onClick={handleUseDemo}
            disabled={usingDemo || saving}
          >
            {usingDemo ? 'Accesso…' : 'Usa demo'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="acct-3">
          <label className="acct-label">Username</label>
          <input
            className={`acct-input ${fieldErrors.username ? 'err' : ''}`}
            value={username}
            onChange={e => { setUsername(e.target.value); if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: undefined }) }}
            placeholder="es. francesco"
            autoComplete="username"
            autoFocus
          />
          {fieldErrors.username && <div className="acct-field-error">{fieldErrors.username}</div>}
        </div>

        <div className="acct-4">
          <label className="acct-label">Password</label>
          <div className="acct-pw-wrap">
            <input
              className={`acct-input ${fieldErrors.password ? 'err' : ''}`}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined }) }}
              placeholder="Almeno 8 caratteri"
              autoComplete="new-password"
              style={{ paddingRight: 64 }}
            />
            <button type="button" className="acct-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
              {showPw ? 'Nascondi' : 'Mostra'}
            </button>
          </div>
          {fieldErrors.password ? (
            <div className="acct-field-error">{fieldErrors.password}</div>
          ) : (
            <div className="acct-hint">8+ caratteri, almeno una lettera e un numero.</div>
          )}
        </div>

        <div className="acct-5">
          <label className="acct-label">Conferma password</label>
          <input
            className={`acct-input ${fieldErrors.confirm ? 'err' : ''}`}
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); if (fieldErrors.confirm) setFieldErrors({ ...fieldErrors, confirm: undefined }) }}
            placeholder="Ripeti la password"
            autoComplete="new-password"
          />
          {fieldErrors.confirm && <div className="acct-field-error">{fieldErrors.confirm}</div>}
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--clay-100)',
              border: '1px solid var(--clay-300)',
              borderRadius: 'var(--rad-sm)',
              fontSize: 'var(--text-sm)',
              color: 'var(--clay-500)',
            }}
          >
            {error}
          </div>
        )}

        <div className="acct-5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button type="submit" className="acct-primary" disabled={saving || usingDemo}>
            {saving ? 'Creazione…' : 'Crea account'}
          </button>
        </div>
      </form>
    </div>
  )
}
