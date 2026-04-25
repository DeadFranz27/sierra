type Props = {
  onBegin: () => void
}

export function IntroStep({ onBegin }: Props) {
  return (
    <div className="intro-root">
      <div className="intro-blob intro-blob-a" aria-hidden />
      <div className="intro-blob intro-blob-b" aria-hidden />

      <main className="intro-content">
        <SierraMark />
        <div className="intro-eyebrow intro-cascade-1">S I E R R A</div>
        <h1 className="intro-headline intro-cascade-2">
          Water, only when it&rsquo;s needed.
        </h1>
        <p className="intro-sub intro-cascade-3">
          Sierra listens to your soil, watches the sky, and cares for each
          zone of your garden &mdash; quietly, on your own network.
        </p>
        <button
          type="button"
          className="intro-cta intro-cascade-4"
          onClick={onBegin}
          aria-label="Begin onboarding"
        >
          Begin <span aria-hidden>&rarr;</span>
        </button>
        <div className="intro-hint intro-cascade-5">Takes about a minute.</div>
      </main>
    </div>
  )
}

// Sierra mark — two leaves growing from a stem.
// The leaves draw their veins first (stroke), then fade-fill.
// Source: Sierra Design System v1.7 (assets/logo/sierra-mark.svg).
function SierraMark() {
  return (
    <svg
      className="intro-mark"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
    >
      {/* Right leaf */}
      <path
        className="intro-mark-leaf intro-mark-leaf-right"
        d="M24 32 C 24 20, 30 10, 42 8 C 42 22, 34 32, 24 32 Z"
        fill="var(--moss-700)"
      />
      <path
        className="intro-mark-vein intro-mark-vein-right"
        d="M24 32 C 30 22, 35 15, 42 8"
        stroke="var(--mist-100)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      {/* Left leaf */}
      <path
        className="intro-mark-leaf intro-mark-leaf-left"
        d="M24 32 C 24 20, 18 10, 6 8 C 6 22, 14 32, 24 32 Z"
        fill="var(--moss-700)"
      />
      <path
        className="intro-mark-vein intro-mark-vein-left"
        d="M24 32 C 18 22, 13 15, 6 8"
        stroke="var(--mist-100)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      {/* Stem */}
      <path
        className="intro-mark-stem"
        d="M24 32 L 24 42"
        stroke="var(--moss-700)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
