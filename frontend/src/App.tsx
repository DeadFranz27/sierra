import { useState, useEffect } from 'react'
import './styles/sierra.css'
import './styles/app.css'
import { api } from './lib/api'
import { parsePath, navigate } from './lib/router'
import type { Route } from './lib/router'
import { Layout } from './components/Layout'
import { ToastContainer } from './components/Toast'
import { LoginScreen } from './screens/LoginScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { ZonesScreen } from './screens/ZonesScreen'
import { ZoneDetailScreen } from './screens/ZoneDetailScreen'
import { ScheduleScreen } from './screens/ScheduleScreen'
import { ProfilesScreen } from './screens/ProfilesScreen'
import { DeviceScreen } from './screens/DeviceScreen'
import { MockControlScreen } from './screens/MockControlScreen'
import { useOnboarding } from './hooks/useOnboarding'

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE !== 'false'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname))
  const { state: onboardingState, refresh: refreshOnboarding } = useOnboarding(authed === true)

  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    api.zones.list()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
  }, [])

  async function handleLogout() {
    await api.auth.logout().catch(() => {})
    setAuthed(false)
    navigate({ page: 'dashboard' })
  }

  function go(r: Route) {
    navigate(r)
  }

  if (authed === null) {
    return (
      <div className="sierra" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>
        Loading…
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="sierra">
        <LoginScreen onLogin={() => {
          setAuthed(true)
          navigate({ page: 'dashboard' })
        }} />
      </div>
    )
  }

  if (onboardingState.status === 'loading') {
    return (
      <div className="sierra" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>
        Loading…
      </div>
    )
  }

  if (onboardingState.status === 'ready' && !onboardingState.progress.is_complete) {
    return (
      <div className="sierra">
        <OnboardingScreen
          initialProgress={onboardingState.progress}
          onComplete={() => {
            refreshOnboarding()
            navigate({ page: 'dashboard' })
          }}
        />
      </div>
    )
  }

  function renderPage() {
    switch (route.page) {
      case 'dashboard': return <DashboardScreen onNavigate={page => go({ page } as Route)} />
      case 'zones':     return <ZonesScreen onSelectZone={id => go({ page: 'zone', id })} />
      case 'zone':      return <ZoneDetailScreen zoneId={route.id} onBack={() => go({ page: 'zones' })} />
      case 'schedule':  return <ScheduleScreen />
      case 'profiles':  return <ProfilesScreen />
      case 'device':    return <DeviceScreen />
      case 'mock':      return <MockControlScreen />
    }
  }

  const activePage = route.page === 'zone' ? 'zones' : route.page

  return (
    <div className="sierra" style={{ height: '100vh' }}>
      <ToastContainer />
      <Layout
        page={activePage as 'dashboard' | 'zones' | 'schedule' | 'profiles' | 'device' | 'mock'}
        onNavigate={page => go({ page } as Route)}
        onLogout={handleLogout}
        mockMode={MOCK_MODE}
      >
        {renderPage()}
      </Layout>
    </div>
  )
}
