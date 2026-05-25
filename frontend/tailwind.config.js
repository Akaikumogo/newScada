/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Deep Space (Dark BG layers) ──────────────────────
        space: {
          950: '#020408',
          900: '#040610',
          800: '#060812',
          700: '#0C0F1E',
          600: '#141728',
          500: '#1E2240',
          400: '#2A2F54',
          300: '#3D4270',
        },
        // ── Electric Blue (Brand) ────────────────────────────
        electric: {
          DEFAULT: '#2979FF',
          50:  '#EBF1FF',
          100: '#C8D8FF',
          200: '#92B3FF',
          300: '#5C9DFF',
          400: '#2979FF',
          500: '#1A62E0',
          600: '#1248C0',
          glow: 'rgba(41,121,255,0.20)',
        },
        // ── Status ───────────────────────────────────────────
        emerald: {
          DEFAULT: '#00D68F',
          glow:    'rgba(0,214,143,0.20)',
        },
        crimson: {
          DEFAULT: '#FF3D71',
          glow:    'rgba(255,61,113,0.20)',
        },
        amber: {
          DEFAULT: '#FFAA00',
          glow:    'rgba(255,170,0,0.20)',
        },
        // ── Premium Gold ─────────────────────────────────────
        gold: {
          DEFAULT: '#FFD060',
          glow:    'rgba(255,208,96,0.20)',
        },
        // ── Neutral (text) ───────────────────────────────────
        ink: {
          50:  '#E8EBF8',
          100: '#C4C9E4',
          200: '#9BA3CC',
          300: '#6B7494',
          400: '#4A5280',
          500: '#3D4270',
          600: '#2A2F54',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      backgroundImage: {
        'gradient-radial':  'radial-gradient(var(--tw-gradient-stops))',
        'card-glow':        'radial-gradient(ellipse at top, rgba(41,121,255,0.06) 0%, transparent 60%)',
        'online-glow':      'radial-gradient(ellipse at top, rgba(0,214,143,0.08) 0%, transparent 60%)',
        'offline-glow':     'radial-gradient(ellipse at top, rgba(255,61,113,0.08) 0%, transparent 60%)',
        'shimmer':          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'ping-slow':    'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'shimmer':      'shimmer 2s infinite',
        'glow-online':  'glowOnline 2s ease-in-out infinite',
        'glow-offline': 'glowOffline 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowOnline: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,214,143,0.3)' },
          '50%':       { boxShadow: '0 0 20px rgba(0,214,143,0.6)' },
        },
        glowOffline: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255,61,113,0.3)' },
          '50%':       { boxShadow: '0 0 20px rgba(255,61,113,0.6)' },
        },
      },
      boxShadow: {
        'card':         '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover':   '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(41,121,255,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
        'electric':     '0 0 20px rgba(41,121,255,0.4)',
        'emerald':      '0 0 20px rgba(0,214,143,0.4)',
        'gold':         '0 0 20px rgba(255,208,96,0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
