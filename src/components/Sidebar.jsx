import { LayoutDashboard, Layers, Users, Settings, ScrollText } from 'lucide-react'
import { useApp } from '../hooks/useAppState'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profiles',  label: 'Profiles',  icon: Layers },
  { id: 'accounts',  label: 'Accounts',  icon: Users },
  { id: 'logs',      label: 'Log',       icon: ScrollText },
  { id: 'settings',  label: 'Settings',  icon: Settings },
]

export default function BottomNav({ current, onNavigate }) {
  const { botStatus } = useApp()

  return (
    <nav style={{
      display: 'flex',
      flexDirection: 'row',
      background: 'var(--bg-elevated)',
      borderTop: '1px solid var(--border)',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,

      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = current === id
        const showDot = id === 'logs' && botStatus === 'running'

        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              padding: '8px 0',
              minHeight: 56,
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.12s',
            }}
          >
            {}
            {active && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                right: '25%',
                height: 2,
                borderRadius: '0 0 2px 2px',
                background: 'var(--accent)',
              }} />
            )}

            <span style={{ position: 'relative' }}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              {showDot && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  animation: 'pulse-dot 2s infinite',
                }} />
              )}
            </span>

            <span style={{
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              lineHeight: 1,
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
