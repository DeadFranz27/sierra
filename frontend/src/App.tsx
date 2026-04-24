import { useState, useEffect } from 'react'
import './styles/sierra.css'
import './styles/app.css'
import { api } from './lib/api'
import type { AuthStatus } from './lib/api'
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
import { useOnboarding } from './hooks/useOnboarding'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname))
  const { state: onboardingState, refresh: refreshOnboarding } = useOnboarding(authed === true)

  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    api.auth.status()
      .then(setAuthStatus)
      .catch(() => setAuthStatus({ has_users: false }))
    api.zones.list()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
  }, [])

  async function handleLogout() {
    await api.auth.logout().catch(() => {})
    setAuthed(false)
    setAuthStatus({ has_users: true })
    navigate({ page: 'dashboard' })
  }

  function go(r: Route) {
    navigate(r)
  }

  if (authed === null || authStatus === null) {
    return (
      <div className="sierra" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>
        Loading…
      </div>
    )
  }

  if (!authed && !authStatus.has_users) {
    return (
      <div className="sierra">
        <OnboardingScreen
          onAccountCreated={() => {
            setAuthed(true)
            setAuthStatus({ ...authStatus, has_users: true })
          }}
          onComplete={() => {
            refreshOnboarding()
            navigate({ page: 'dashboard' })
          }}
        />
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
          onAccountCreated={() => {}}
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
    }
  }

  const activePage = route.page === 'zone' ? 'zones' : route.page

  return (
    <div className="sierra" style={{ height: '100vh' }}>
      <ToastContainer />
      <Layout
        page={activePage as 'dashboard' | 'zones' | 'schedule' | 'profiles' | 'device'}
        onNavigate={page => go({ page } as Route)}
        onLogout={handleLogout}
      >
        {renderPage()}
      </Layout>
    </div>
  )
}
