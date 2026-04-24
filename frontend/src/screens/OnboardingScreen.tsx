import { useState } from 'react'
import { api } from '../lib/api'
import type { OnboardingProgress } from '../lib/api'
import './onboarding/onboarding.css'
import { WizardShell } from './onboarding/WizardShell'
import { CreateAccountStep } from './onboarding/CreateAccountStep'
import { WelcomeStep } from './onboarding/WelcomeStep'
import { ZoneStep } from './onboarding/ZoneStep'
import { LocationStep } from './onboarding/LocationStep'
import { DoneStep } from './onboarding/DoneStep'
import {
  WIZARD_STEPS_WITH_ACCOUNT,
  WIZARD_STEPS_POST_LOGIN,
  type WizardStep,
  type WizardSnapshot,
} from './onboarding/types'

type Props = {
  initialProgress?: OnboardingProgress
  demoMode: boolean
  onAccountCreated: () => void
  onComplete: () => void
}

function clampStep(raw: number, min: WizardStep): WizardStep {
  if (raw < min) return min
  if (raw > 4) return 4
  return raw as WizardStep
}

export function OnboardingScreen({ initialProgress, demoMode, onAccountCreated, onComplete }: Props) {
  const startingFromAccount = !initialProgress
  const minStep: WizardStep = startingFromAccount ? 0 : 1
  const steps = startingFromAccount ? WIZARD_STEPS_WITH_ACCOUNT : WIZARD_STEPS_POST_LOGIN

  const [step, setStep] = useState<WizardStep>(
    clampStep(initialProgress?.current_step ?? 0, minStep),
  )
  const [snapshot, setSnapshot] = useState<WizardSnapshot>(
    (initialProgress?.state_snapshot as WizardSnapshot | null) ?? {},
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function persist(nextStep: WizardStep, nextSnapshot: WizardSnapshot) {
    if (nextStep < 1) return
    try {
      await api.onboarding.saveProgress({
        current_step: nextStep,
        state_snapshot: nextSnapshot as Record<string, unknown>,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
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
      setError(e instanceof Error ? e.message : 'Network error')
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
      setError(e instanceof Error ? e.message : 'Network error')
      setBusy(false)
    }
  }

  async function handleAccountReady() {
    onAccountCreated()
    setStep(1)
    await persist(1, snapshot)
  }

  return (
    <WizardShell currentStep={step} steps={steps}>
      {step === 0 && (
        <CreateAccountStep
          demoMode={demoMode}
          onAccountCreated={handleAccountReady}
          onUseDemo={handleAccountReady}
        />
      )}
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
