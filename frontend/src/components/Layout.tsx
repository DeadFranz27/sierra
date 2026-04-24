import { Icon } from './Icon'

type Page = 'dashboard' | 'zones' | 'schedule' | 'profiles' | 'device'

type Props = {
  page: Page
  onNavigate: (p: Page) => void
  onLogout: () => void
  children: React.ReactNode
}

const navItems: { id: Page; icon: Parameters<typeof Icon>[0]['name']; label: string }[] = [
  { id: 'dashboard', icon: 'home',     label: 'Dashboard' },
  { id: 'zones',     icon: 'sprout',   label: 'Zones' },
  { id: 'schedule',  icon: 'cal',      label: 'Schedule' },
  { id: 'profiles',  icon: 'leaf',     label: 'Plant library' },
  { id: 'device',    icon: 'cpu',      label: 'Device' },
]

export function Layout({ page, onNavigate, onLogout, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        gap: 16,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          color: 'var(--fg-brand)',
          letterSpacing: '-0.01em',
        }}>Sierra</span>

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 10px',
          background: 'var(--mist-300)',
          border: '1px solid var(--moss-200)',
          borderRadius: 999,
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--moss-700)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--state-good)', boxShadow: '0 0 0 3px rgba(78,122,92,.22)', flexShrink: 0 }} />
          LOCAL
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--moss-600)', marginLeft: 2 }}>sierra-hub.local</span>
        </div>

        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            width: 34, height: 34,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
          }}
        >
          <Icon name="logout" size={17} />
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <nav style={{
          width: 220,
          borderRight: '1px solid var(--border)',
          padding: '18px 12px',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
          overflowY: 'auto',
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--fg-muted)',
            padding: '6px 10px 10px',
          }}>Garden</div>

          {navItems.map(({ id, icon, label }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'var(--mist-300)' : 'transparent',
                  color: active ? 'var(--fg-brand)' : 'var(--fg)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  textAlign: 'left',
                }}
              >
                <Icon name={icon} size={17} />
                {label}
              </button>
            )
          })}
        </nav>

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
