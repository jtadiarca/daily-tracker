const role = n => `rgb(var(--md-${n}) / <alpha-value>)`

// Material 3 color roles. The actual values live in src/index.css so they can switch for dark mode.
const roles = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'surface', 'on-surface', 'on-surface-variant',
  'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest',
  'outline', 'outline-variant',
  'inverse-surface', 'inverse-on-surface', 'inverse-primary', 'scrim',
]

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      // Material 3 window size classes. "medium" (600px+) covers phones in landscape and tablets:
      // the bottom bar becomes a side rail. "expanded" (840px+) gets two-column layouts.
      // "short" is a landscape phone, where vertical space is tight.
      screens: {
        medium: { raw: '(min-width: 600px)' },
        expanded: { raw: '(min-width: 840px)' },
        short: { raw: '(max-height: 500px)' },
      },
      colors: Object.fromEntries(roles.map(r => [r, role(r)])),
      borderRadius: { 'm3-xs': '4px', 'm3-sm': '8px', 'm3-md': '12px', 'm3-lg': '16px', 'm3-xl': '28px' },
      boxShadow: {
        'm3-1': '0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15)',
        'm3-2': '0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)',
        'm3-3': '0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15)',
      },
      fontFamily: { sans: ['Roboto', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
}
