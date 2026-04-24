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
        <div className="acct-2 acct-demo-banner" style={{ marginBottom: 20 }}>
          <span>
            You can also try the demo account right away (<span className="mono">demo</span> / <span className="mono">sierra2024</span>).
          </span>
          <button
            type="button"
            className="acct-demo-btn"
            onClick={handleUseDemo}
            disabled={usingDemo || saving}
          >
            {usingDemo ? 'Signing in…' : 'Use demo'}
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
            placeholder="e.g. alex"
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
              placeholder="At least 8 characters"
              autoComplete="new-password"
              style={{ paddingRight: 72 }}
            />
            <button
              type="button"
              className="acct-pw-toggle"
              onClick={() => setShowPw(v => !v)}
              tabIndex={-1}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password ? (
            <div className="acct-field-error">{fieldErrors.password}</div>
          ) : (
            <div className="acct-hint">8+ characters, at least one letter and one number.</div>
          )}
        </div>

        <div className="acct-5">
          <label className="acct-label">Confirm password</label>
          <input
            className={`acct-input ${fieldErrors.confirm ? 'err' : ''}`}
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); if (fieldErrors.confirm) setFieldErrors({ ...fieldErrors, confirm: undefined }) }}
            placeholder="Repeat the password"
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
          >
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  )
}
