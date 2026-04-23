import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { OnboardingProgress } from '../lib/api'

type State =
  | { status: 'loading' }
  | { status: 'ready'; progress: OnboardingProgress }
  | { status: 'error'; error: string }

export function useOnboarding(enabled: boolean) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      const progress = await api.onboarding.progress()
      setState({ status: 'ready', progress })
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    setState({ status: 'loading' })
    load()
  }, [enabled, load])

  return {
    state,
    refresh: load,
  }
}
