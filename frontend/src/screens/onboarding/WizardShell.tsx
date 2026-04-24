import type { ReactNode } from 'react'
import type { WizardStep } from './types'

type Props = {
  currentStep: WizardStep
  steps: readonly number[]
  children: ReactNode
}

export function WizardShell({ currentStep, steps, children }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at 30% 20%, var(--mist-300), transparent 55%), radial-gradient(circle at 70% 80%, var(--sage-100), transparent 60%), var(--bg)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 24px 0',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {steps.map((s) => (
            <div
              key={s}
              className={`onb-dot ${s === currentStep ? 'active' : s < currentStep ? 'done' : ''}`}
              aria-label={`Step ${s}${s === currentStep ? ' (current)' : ''}`}
            />
          ))}
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div key={currentStep} className="onb-step" style={{ width: '100%', maxWidth: 560 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
