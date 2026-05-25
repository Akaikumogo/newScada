/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Light mode surfaces ──────────────────────────
        surface: {
          50:  '#F8FAFF',
          100: '#F0F4FF',
          200: '#E5EAFF',
          300: '#D6DEFF',
        },
        // ── Dark mode surfaces ───────────────────────────
        dark: {
          50:  '#1C2036',
          100: '#141728',
          200: '#0C0F1E',
          300: '#060812',
          border: 'rgba(30,34,64,0.9)',
        },
        // ── Brand ────────────────────────────────────────
        brand: {
          DEFAULT: '#2979FF',
          50:  '#EBF1FF',
          100: '#C8D8FF',
          200: '#92B3FF',
          300: '#5C9DFF',
          400: '#2979FF',
          500: '#1A62E0',
          600: '#1248C0',
          hover: '#1A62E0',
        },
        // ── Semantic ─────────────────────────────────────
        success: { DEFAULT: '#1A7F37', dark: '#3FB950', bg: '#EFFAF3', 'dark-bg': '#1A7F371A' },
        danger:  { DEFAULT: '#CF222E', dark: '#FF3D71', bg: '#FFF0F0', 'dark-bg': '#CF222E1A' },
        warning: { DEFAULT: '#9A6700', dark: '#FFAA00', bg: '#FFF8E6', 'dark-bg': '#9A67001A' },
        info:    { DEFAULT: '#0969DA', dark: '#79C0FF', bg: '#EBF4FF', 'dark-bg': '#0969DA1A' },
        // ── Neutral ──────────────────────────────────────
        slate: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      animation: {
        'in-up':     'inUp 0.3s ease-out',
        'in-scale':  'inScale 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        'shimmer':   'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        inUp:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        inScale:{ from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:{ '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-lg': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'modal':   '0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
        'dropdown':'0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
