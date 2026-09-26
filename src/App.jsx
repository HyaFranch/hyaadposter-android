import { useState } from 'react'
import { AppProvider } from './hooks/useAppState'
import BottomNav from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Profiles  from './pages/Profiles'
import Accounts  from './pages/Accounts'
import Settings  from './pages/Settings'
import Logs      from './pages/Logs'

const PAGES = {
  dashboard: Dashboard,
  profiles:  Profiles,
  accounts:  Accounts,
  settings:  Settings,
  logs:      Logs,
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const Page = PAGES[page] ?? Dashboard

  return (
    <AppProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--bg)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg)',
          padding: '20px 16px',

          paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)',
          WebkitOverflowScrolling: 'touch',
        }}>
          <Page />
        </main>

        <BottomNav current={page} onNavigate={setPage} />
      </div>
    </AppProvider>
  )
}
