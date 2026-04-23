type Props = {
  onNext: () => void
  onSkip: () => void
  skipping: boolean
  error: string
}

export function WelcomeStep({ onNext, onSkip, skipping, error }: Props) {
  return (
    <div style={{ textAlign: 'center' }}>
      <style>{`
        @keyframes sierra-welcome-1 {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sierra-welcome-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .welcome-1 { animation: sierra-welcome-1 var(--dur-emphasis) var(--ease-standard) both; }
        .welcome-2 { animation: sierra-welcome-1 var(--dur-emphasis) var(--ease-standard) 140ms both; }
        .welcome-3 { animation: sierra-welcome-1 var(--dur-emphasis) var(--ease-standard) 280ms both; }
        .welcome-4 { animation: sierra-welcome-fade var(--dur-emphasis) var(--ease-standard) 440ms both; }

        .welcome-primary {
          padding: 12px 28px;
          background: var(--fg-brand);
          color: #fff;
          border: none;
          border-radius: var(--rad-pill);
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: var(--text-base);
          cursor: pointer;
          transition: transform var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard);
          box-shadow: var(--elev-1);
        }
        .welcome-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--elev-2); }
        .welcome-primary:active { background: var(--accent-press); transform: translateY(0); }
        .welcome-primary:disabled { background: var(--moss-400); cursor: not-allowed; transform: none; box-shadow: none; }

        .welcome-skip {
          background: transparent;
          border: none;
          color: var(--fg-subtle);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          padding: 6px 10px;
        }
        .welcome-skip:hover { color: var(--fg-muted); }
        .welcome-skip:disabled { cursor: not-allowed; opacity: 0.6; }
      `}</style>

      <div className="eyebrow welcome-1" style={{ marginBottom: 20 }}>
        Benvenuto
      </div>

      <h1
        className="welcome-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-4xl)',
          lineHeight: 'var(--lh-tight)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--fg-brand)',
          marginBottom: 16,
        }}
      >
        Il tuo giardino, in pochi passi.
      </h1>

      <p className="lead welcome-3" style={{ marginBottom: 40 }}>
        Configuriamo insieme la prima zona, il profilo giusto per le tue piante
        <br />
        e la tua posizione per l'irrigazione intelligente.
      </p>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            background: 'var(--clay-100)',
            border: '1px solid var(--clay-300)',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--clay-500)',
          }}
        >
          {error}
        </div>
      )}

      <div className="welcome-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          className="welcome-primary"
          onClick={onNext}
          disabled={skipping}
        >
          Inizia
        </button>

        <button
          type="button"
          className="welcome-skip"
          onClick={onSkip}
          disabled={skipping}
        >
          {skipping ? 'Attendere…' : 'Salta per ora'}
        </button>
      </div>
    </div>
  )
}
