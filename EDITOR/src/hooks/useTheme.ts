import { useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('newscada-editor-theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return 'light' // Editor default: light
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('newscada-editor-theme', theme)
  }, [theme])

  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle, isDark: theme === 'dark' }
}
