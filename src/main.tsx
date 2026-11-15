import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, watchSystemMode } from './features/settings/themePrefs'

// Apply the saved color theme and light/dark mode before the first render so the default colors never flash.
applyTheme()
watchSystemMode()

// The service worker is registered by vite-plugin-pwa (see vite.config.ts).
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
