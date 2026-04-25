type Props = {
  onBegin: () => void
}

export function IntroStep({ onBegin }: Props) {
  return (
    <div className="intro-root">
      <div className="intro-blob intro-blob-a" aria-hidden />
      <div className="intro-blob intro-blob-b" aria-hidden />

      <main className="intro-content">
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
