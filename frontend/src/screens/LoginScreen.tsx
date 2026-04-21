import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { Icon } from '../components/Icon'

type Props = { onLogin: () => void }

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.auth.login(username, password)
      onLogin()
    } catch {
      setError('Invalid credentials — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 44,
            color: 'var(--fg-brand)',
            letterSpacing: '-0.02em',
            marginBottom: 8,
          }}>Sierra</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--fg-muted)' }}>
            Sign in to your garden
          </div>
        </div>

        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
          boxShadow: 'var(--elev-2)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--fg)',
                marginBottom: 6,
              }}>Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  color: 'var(--fg)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--fg)',
                marginBottom: 6,
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  color: 'var(--fg)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'var(--clay-100)',
                border: '1px solid var(--clay-300)',
                borderRadius: 10,
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--clay-500)',
              }}>
                <Icon name="warn" size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px 20px',
                background: loading ? 'var(--moss-400)' : 'var(--fg-brand)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: 'var(--mist-300)',
          border: '1px solid var(--moss-200)',
          borderRadius: 12,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--moss-700)',
        }}>
          <Icon name="lock" size={14} />
          Session stays on your local network. No data leaves your hub.
        </div>
      </div>
    </div>
  )
}
