type Props = {
  onNext: () => void
  onSkip: () => void
  skipping: boolean
  error: string
}

export function WelcomeStep({ onNext, onSkip, skipping, error }: Props) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="eyebrow welcome-1" style={{ marginBottom: 20 }}>
        Account ready
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
        Let's set up your garden.
      </h1>

      <p className="lead welcome-3" style={{ marginBottom: 40 }}>
        Your account is ready. In a few quick steps we'll create your first zone,
        <br />
        pick a plant profile and set the location for smart watering.
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
          Get started
        </button>

        <button
          type="button"
          className="welcome-skip"
          onClick={onSkip}
          disabled={skipping}
        >
          {skipping ? 'Please wait…' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
