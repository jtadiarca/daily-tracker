import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Daily Task Tracker',
        short_name: 'Daily Tasks',
        description: 'A personal daily to-do app with reminders, streaks and offline support.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FEF7FF',
        theme_color: '#6750A4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  // material-color-utilities 0.4.0 has an import without a .js extension that Node rejects, so let Vite process it in tests.
  test: { environment: 'node', server: { deps: { inline: ['@material/material-color-utilities'] } } },
})
