import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { PlantProfile } from '../../lib/api'
import { PlantCategoryIcon } from '../../components/PlantCategoryIcon'
import type { WizardSnapshot } from './types'

type Props = {
  snapshot: WizardSnapshot
  onBack: () => void
  onFinish: () => Promise<void>
  finishing: boolean
  error: string
}

export function DoneStep({ snapshot, onBack, onFinish, finishing, error }: Props) {
  const [profile, setProfile] = useState<PlantProfile | null>(null)

  useEffect(() => {
    if (!snapshot.profile_id) return
    let mounted = true
    api.profiles.get(snapshot.profile_id)
      .then(p => { if (mounted) setProfile(p) })
      .catch(() => { /* best-effort: il riepilogo resta senza icona */ })
    return () => { mounted = false }
  }, [snapshot.profile_id])

  const hasLocation = Boolean(snapshot.location_label && snapshot.location_lat != null && snapshot.location_lon != null)

  return (
    <div style={{ textAlign: 'center' }}>
      <style>{`
        @keyframes sierra-done-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sierra-done-pop {
          0%   { opacity: 0; transform: scale(.6) rotate(-12deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes sierra-done-ring {
          from { transform: scale(.4); opacity: .55; }
          to   { transform: scale(1.6); opacity: 0; }
        }
        .done-1 { animation: sierra-done-in var(--dur-emphasis) var(--ease-standard) 120ms both; }
        .done-2 { animation: sierra-done-in var(--dur-emphasis) var(--ease-standard) 260ms both; }
        .done-3 { animation: sierra-done-in var(--dur-emphasis) var(--ease-standard) 380ms both; }
        .done-4 { animation: sierra-done-in var(--dur-emphasis) var(--ease-standard) 520ms both; }
        .done-seal-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 84px; height: 84px; margin-bottom: 20px; }
        .done-seal {
          width: 84px; height: 84px;
          border-radius: var(--rad-pill);
          background: var(--fern-500);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 18px rgba(78,122,92,.32);
          animation: sierra-done-pop 560ms var(--ease-standard) both;
        }
        .done-ring {
          position: absolute; inset: 0;
          border-radius: var(--rad-pill);
          border: 2px solid var(--fern-400);
          animation: sierra-done-ring 900ms var(--ease-standard) 260ms both;
          pointer-events: none;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--rad-md);
          text-align: left;
        }
        .summary-icon {
          width: 44px; height: 44px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--mist-300);
          border-radius: var(--rad-sm);
        }
        .summary-icon.muted {
          background: var(--stone-100);
          color: var(--fg-subtle);
        }
        .summary-label {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--fg-muted);
          text-transform: uppercase;
          letter-spacing: var(--tracking-eyebrow);
          margin-bottom: 2px;
        }
        .summary-value {
          font-family: var(--font-sans);
          font-size: var(--text-base);
          color: var(--fg);
          line-height: 1.35;
        }
        .summary-value.muted { color: var(--fg-subtle); }
        .summary-sub {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--fg-muted);
          margin-top: 2px;
        }

        .done-primary {
          padding: 12px 28px;
          background: var(--fg-brand);
          color: #fff;
          border: none;
          border-radius: var(--rad-pill);
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: var(--text-base);
          cursor: pointer;
          box-shadow: var(--elev-1);
          transition: all var(--dur-base) var(--ease-standard);
        }
        .done-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--elev-2); }
        .done-primary:active { background: var(--accent-press); transform: translateY(0); }
        .done-primary:disabled { background: var(--moss-400); cursor: not-allowed; transform: none; box-shadow: none; }

        .done-secondary {
          padding: 10px 20px;
          background: transparent;
          color: var(--fg-muted);
          border: 1px solid var(--border);
          border-radius: var(--rad-pill);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--dur-base) var(--ease-standard);
        }
        .done-secondary:hover { border-color: var(--border-strong); color: var(--fg); }
      `}</style>

      <div className="done-seal-wrap">
        <div className="done-seal">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="done-ring" />
      </div>

      <div className="eyebrow done-1" style={{ marginBottom: 12 }}>
        All set
      </div>

      <h2
        className="done-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          lineHeight: 'var(--lh-snug)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--fg-brand)',
          marginBottom: 14,
        }}
      >
        Your garden is taking shape.
      </h2>

      <p className="lead done-2" style={{ marginBottom: 28 }}>
        Here's the setup. You can change everything later from the dashboard.
      </p>

      <div className="done-3" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        <div className="summary-card">
          <div className="summary-icon">
            {profile ? (
              <PlantCategoryIcon category={profile.category ?? 'Vegetables'} size={28} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--fern-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L12 22" />
                <path d="M12 10 C 7 10, 5 7, 5 4 C 9 4, 12 6, 12 10 Z" />
                <path d="M12 14 C 17 14, 19 11, 19 8 C 15 8, 12 10, 12 14 Z" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="summary-label">Zone</div>
            <div className="summary-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {snapshot.zone_name ?? '—'}
            </div>
            {profile && (
              <div className="summary-sub">{profile.name}</div>
            )}
          </div>
        </div>

        <div className="summary-card">
          <div className={`summary-icon ${hasLocation ? '' : 'muted'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={hasLocation ? 'var(--fern-500)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="summary-label">Location</div>
            {hasLocation ? (
              <>
                <div className="summary-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {snapshot.location_label}
                </div>
                <div className="summary-sub">
                  {snapshot.location_lat!.toFixed(4)}, {snapshot.location_lon!.toFixed(4)}
                </div>
              </>
            ) : (
              <div className="summary-value muted">Not set — you can add it later from settings.</div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
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

      <div className="done-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button type="button" className="done-secondary" onClick={onBack} disabled={finishing}>
          Back
        </button>
        <button type="button" className="done-primary" onClick={onFinish} disabled={finishing}>
          {finishing ? 'Opening…' : 'Go to dashboard'}
        </button>
      </div>
    </div>
  )
}
