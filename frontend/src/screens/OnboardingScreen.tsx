import { useState } from 'react'
import { api } from '../lib/api'
import type { OnboardingProgress } from '../lib/api'
import { WizardShell } from './onboarding/WizardShell'
import { WelcomeStep } from './onboarding/WelcomeStep'
import { ZoneStep } from './onboarding/ZoneStep'
import { LocationStep } from './onboarding/LocationStep'
import { DoneStep } from './onboarding/DoneStep'
import { WIZARD_STEPS, type WizardStep, type WizardSnapshot } from './onboarding/types'

type Props = {
  initialProgress: OnboardingProgress
  onComplete: () => void
}

function clampStep(raw: number): WizardStep {
  if (raw < 1) return 1
  const max = WIZARD_STEPS[WIZARD_STEPS.length - 1]
  if (raw > max) return max
  return raw as WizardStep
}

export function OnboardingScreen({ initialProgress, onComplete }: Props) {
  const [step, setStep] = useState<WizardStep>(clampStep(initialProgress.current_step))
  const [snapshot, setSnapshot] = useState<WizardSnapshot>(
    (initialProgress.state_snapshot as WizardSnapshot | null) ?? {},
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function persist(nextStep: WizardStep, nextSnapshot: WizardSnapshot) {
    try {
      await api.onboarding.saveProgress({
        current_step: nextStep,
        state_snapshot: nextSnapshot as Record<string, unknown>,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
    }
  }

  async function goTo(nextStep: WizardStep, patch?: Partial<WizardSnapshot>) {
    setError('')
    const nextSnapshot = patch ? { ...snapshot, ...patch } : snapshot
    if (patch) setSnapshot(nextSnapshot)
    setStep(nextStep)
    await persist(nextStep, nextSnapshot)
  }

  async function handleSkip() {
    setError('')
    setBusy(true)
    try {
      await api.onboarding.complete()
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
      setBusy(false)
    }
  }

  async function handleFinish() {
    setError('')
    setBusy(true)
    try {
      await api.onboarding.complete()
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
      setBusy(false)
    }
  }

  return (
    <WizardShell currentStep={step}>
      {step === 1 && (
        <WelcomeStep
          onNext={() => goTo(2)}
          onSkip={handleSkip}
          skipping={busy}
          error={error}
        />
      )}
      {step === 2 && (
        <ZoneStep
          snapshot={snapshot}
          onBack={() => goTo(1)}
          onDone={(patch) => goTo(3, patch)}
        />
      )}
      {step === 3 && (
        <LocationStep
          snapshot={snapshot}
          onBack={() => goTo(2)}
          onDone={(patch) => goTo(4, patch)}
          onSkip={() => goTo(4)}
        />
      )}
      {step === 4 && (
        <DoneStep
          snapshot={snapshot}
          onBack={() => goTo(3)}
          onFinish={handleFinish}
          finishing={busy}
          error={error}
        />
      )}
    </WizardShell>
  )
}
