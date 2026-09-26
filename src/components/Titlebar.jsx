import { Minus, Square, X } from 'lucide-react'
import { useApp } from '../hooks/useAppState'

const STATUS_COLOR = {
  idle:     'var(--text-dim)',
  running:  'var(--success)',
  stopping: 'var(--warning)',
  expired:  'var(--danger)',
}

const STATUS_LABEL = {
  idle:     'Idle',
  running:  'Running',
  stopping: 'Stopping…',
  expired:  'Cookie expired',
}

const ICON_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAdHElEQVR4nO2b6XNc13nmf2e9W+8ASAAUt5EsK04kWVLsbJVJKlOZzFSq5q+dD5NJeRIrsSQrVuyxbFIbSVHcRBBAN7r77vecMx9uA4Qo2o49M/GH5Fah2EQ37rnnPe/yvM/ztgAC/4Yv+dt+gN/29e8G+G0/wG/7+ncD/GsuJoRACPGvueSvvP7Ne4D+bSwqhCCE8LXfnV7Pvvf/eu3z6/zGHvDL3Pn/xtX/f27+eesIKWU4v6iU8hc+yK/a1PmNhxC+dtLnX3vvzz7zPIN573/NLf3y6xc9u37eA/yiDz/PbZ/97HkDnjeA1hpjDFmWYa3FOUdRFBRFQdM0XzHIecOcvj69fhPDCCGQUj43zDRy88tw9ulfeqPn3fj0ZiEEnHMIIVBKYa0lSRKGwyFbW1tMp1PiOEZrjRAC7z1lWbJer8nznPl8zmq1oigKyrLEOfeVtc6v9+uGyrOGPLuvMjoEQPjwa8fu6SZCCFhrsdYSRRGTyYTpdEqWpSRJShRFaK2RUuKDRwqJUgqtFFIptNYopfDe4zpHWZUsFgsODw9Zr9ccHh6yXC6pqups7fOG/1XP+IvCDEBoY8JvWpmNMWRpSjYYsLW1RZZlRFFCFEUopQgBpASpBEoqrLEoJRGbMBFSomRvDCUlQkikUkjZe9BpCFRVRVmWLJdLvvzyS27cuMFisTgLN/jlyfO8+3/Ni40xX/vLX3YzIQQB2JrNuHz5MknydMNSyrOHOn19+hNZizX2Kw8j5VNP0FIRBAQVIAgQEkLojaQUZhM2Ukru3LnD3/zN/+D4eL4x9NMQ/HUMIIR4ThkMAYInPOeH4OnalixJuHbtCpPxEGstwXucawnBAR1KBYwRSOkBB3jkxgVd20LXoggoCVqADiC8QwqPlKBUQImAlgIFyADOdbRdS900XLt6jb/8y79iOBye5ZxfdT0vB4QQnuMBp5t9zuV9II4jvvnyN5ltjRGyz+5KKoToXdf7gJQSYwxCSqQQaKnIsgQjJc45VJCoJEZohUaghMLjQXi833gHbJIlCClASoQUBKFouwAhcPv2Hd5++20ODw/Pcsgv8oDz4XK6+X+xAU6TnVKa69evsb+/jzEKrRVSapTuY7g3kkcpidamT4rKkFiDtRESRdM0SCOxGwNYqRBB4ILDdS3BBUIAvckBhKcuLIXEKyh9Q1nWGBWT5zn/8I9vc+PGTbTWeO94NhLOl8EQwqbSBYL/FxoghIDWmitXLrO7u0ccR0SRRamncWmMRmuDMX1GD/SurYRAKoX3gbKoWa2WyFgzGA4YZAMGcUJkLQiBEgIjFAhB4zq898gAArGpzoJAIG8qiroCCVobAvD33/8+P/7gpygl6Pe4OfFNdQuiN4QL/swQIYSv9wLPSyNKKfb399ne3umT1gbUGGNQSgICrRVaG+I4xntPXdeUdcOTw0MeHx3StR0niyV5kRNFhsFggE0TtiYTXtjdZzgYMEgzJoMRUisipRFa4LzvS62AIATCBwwSLSQOaNsOqSR

export default function Titlebar() {
  const { botStatus } = useApp()
  const api = window.electronAPI

  return (
    <div style={{
      height: 40,
      display: 'flex',
      alignItems: 'center',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border)',
      WebkitAppRegion: 'drag',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, minWidth: 200 }}>
        <img
          src={`data:image/png;base64,${ICON_B64}`}
          alt="HyaAdPoster"
          style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }}
        />
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          HyaAdPoster
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.02em' }}>v2.0</span>
      </div>

      {}
      <div style={{ flex: 1 }} />

      {}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px',
        background: 'var(--surface)',
        borderRadius: 99,
        border: '1px solid var(--border)',
      }}>
        <span style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: STATUS_COLOR[botStatus] ?? 'var(--text-dim)',
          boxShadow: botStatus === 'running' ? '0 0 8px var(--success)' : 'none',
          animation: botStatus === 'running' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
          {STATUS_LABEL[botStatus] ?? botStatus}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {}
      {api && (
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
          {[
            { icon: <Minus size={12} />, action: 'minimize', color: '#fbbf24' },
            { icon: <Square size={11} />, action: 'maximize', color: 'var(--accent)' },
            { icon: <X size={12} />,    action: 'close',    color: '#f0546e' },
          ].map(({ icon, action, color }) => (
            <button
              key={action}
              onClick={() => api.window[action]()}
              style={{
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none',
                color: 'var(--text-dim)', cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = action === 'close' ? 'var(--danger-dim)' : 'var(--surface)'; e.currentTarget.style.color = color }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
