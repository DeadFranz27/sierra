import { useState } from 'react'
import type { FormEvent, CSSProperties } from 'react'
import { api } from '../../lib/api'

type Props = {
  demoMode: boolean
  onAccountCreated: () => void
  onUseDemo: () => void
}

const USERNAME_RE = /^[a-zA-Z0-9._-]+$/

function validateUsername(v: string): string {
  if (!v.trim()) return 'Pick a username'
  if (v.length < 3) return 'At least 3 characters'
  if (v.length > 64) return 'Maximum 64 characters'
  if (!USERNAME_RE.test(v)) return 'Letters, numbers, dot, dash, underscore only'
  return ''
}

function validatePassword(v: string): string {
  if (v.length < 8) return 'At least 8 characters'
  if (!/[A-Za-z]/.test(v)) return 'At least one letter'
  if (!/\d/.test(v)) return 'At least one number'
  return ''
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-eyebrow)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--rad-sm)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-base)',
  color: 'var(--fg)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)',
}

const inputErrStyle: CSSProperties = {
  ...inputStyle,
  borderColor: 'var(--clay-500)',
}

const hintStyle: CSSProperties = {
  marginTop: 6,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  color: 'var(--fg-subtle)',
}

const fieldErrorStyle: CSSProperties = {
  marginTop: 6,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  color: 'var(--state-bad)',
}

const primaryBtnStyle: CSSProperties = {
  padding: '11px 24px',
  background: 'var(--fg-brand)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--rad-pill)',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
  boxShadow: 'var(--elev-1)',
  transition: 'background var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)',
}

const primaryBtnDisabledStyle: CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--moss-400)',
  cursor: 'not-allowed',
  boxShadow: 'none',
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
    if (confirm !== password) errs.confirm = 'Passwords do not match'
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
      const msg = err instanceof Error ? err.message : 'Could not create account'
      if (msg.toLowerCase().includes('taken')) {
        setFieldErrors({ username: 'Username already taken' })
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
      setError(err instanceof Error ? err.message : 'Could not sign in as demo')
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
        .acct-input:focus { border-color: var(--border-focus) !important; box-shadow: var(--focus-ring); }
        .acct-primary:hover:not(:disabled) { background: var(--accent-hover) !important; transform: translateY(-1px); box-shadow: var(--elev-2) !important; }
        .acct-primary:active:not(:disabled) { background: var(--accent-press) !important; transform: translateY(0); }
      `}</style>

      <div className="eyebrow acct-1" style={{ marginBottom: 12, textAlign: 'center' }}>
        The first step
      </div>

      <h2
        className="acct-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'var(--text-3xl)',
          lineHeight: 'var(--lh-snug)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--fg-brand)',
          marginBottom: 14,
          textAlign: 'center',
        }}
      >
        Create your account.
      </h2>

      <p className="lead acct-2" style={{ marginBottom: 24, textAlign: 'center' }}>
        Username and password stay on your hub. Nobody sees them outside.
      </p>

      {demoMode && (
        <div
          className="acct-2"
          style={{
            padding: '12px 14px',
            background: 'var(--mist-300)',
            border: '1px solid var(--moss-200)',
            borderRadius: 'var(--rad-sm)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--moss-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <span>
            You can also try the demo account right away (<span className="mono">demo</span> / <span className="mono">sierra2024</span>).
          </span>
          <button
            type="button"
            onClick={handleUseDemo}
            disabled={usingDemo || saving}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-link)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: usingDemo || saving ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              padding: '4px 6px',
              opacity: usingDemo || saving ? 0.6 : 1,
            }}
          >
            {usingDemo ? 'Signing in…' : 'Use demo'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="acct-3">
          <label style={labelStyle}>Username</label>
          <input
            className="acct-input"
            value={username}
            onChange={e => { setUsername(e.target.value); if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: undefined }) }}
            placeholder="e.g. francesco"
            autoComplete="username"
            autoFocus
            style={fieldErrors.username ? inputErrStyle : inputStyle}
          />
          {fieldErrors.username && <div style={fieldErrorStyle}>{fieldErrors.username}</div>}
        </div>

        <div className="acct-4">
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="acct-input"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined }) }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              style={{ ...(fieldErrors.password ? inputErrStyle : inputStyle), paddingRight: 72 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              tabIndex={-1}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--fg-muted)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password ? (
            <div style={fieldErrorStyle}>{fieldErrors.password}</div>
          ) : (
            <div style={hintStyle}>8+ characters, at least one letter and one number.</div>
          )}
        </div>

        <div className="acct-5">
          <label style={labelStyle}>Confirm password</label>
          <input
            className="acct-input"
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); if (fieldErrors.confirm) setFieldErrors({ ...fieldErrors, confirm: undefined }) }}
            placeholder="Repeat the password"
            autoComplete="new-password"
            style={fieldErrors.confirm ? inputErrStyle : inputStyle}
          />
          {fieldErrors.confirm && <div style={fieldErrorStyle}>{fieldErrors.confirm}</div>}
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--clay-100)',
              border: '1px solid var(--clay-300)',
              borderRadius: 'var(--rad-sm)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              color: 'var(--clay-500)',
            }}
          >
            {error}
          </div>
        )}

        <div className="acct-5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            type="submit"
            className="acct-primary"
            disabled={saving || usingDemo}
            style={saving || usingDemo ? primaryBtnDisabledStyle : primaryBtnStyle}
          >
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  )
}
