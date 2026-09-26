import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

function mount() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

if (window.Capacitor?.isNativePlatform?.()) {
  document.addEventListener('deviceready', mount, { once: true })

  setTimeout(mount, 3000)
} else {
  mount()
}
