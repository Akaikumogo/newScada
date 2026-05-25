import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Zap, Moon, Sun, GitBranch, Building2, Server, Layers, Network, Activity } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { path: '/branches',    label: 'Filiallar',     icon: GitBranch },
  { path: '/substations', label: 'Podstansiyalar', icon: Building2 },
  { path: '/devices',     label: 'Qurilmalar',    icon: Server     },
  { path: '/models',      label: 'Modellar',      icon: Layers     },
  { path: '/log',         label: 'Log',           icon: Activity   },
]

export function TopBar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { theme, toggle } = useTheme()

  function isActive(path: string) {
    return location.pathname.startsWith(path)
  }

  return (
    <motion.header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 h-14',
        'flex items-center justify-between gap-4 px-5',
        'bg-[var(--bg-card)]/90 backdrop-blur-xl',
        'border-b border-[var(--border)]',
      )}
      initial={{ y: -14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer"
        onClick={() => navigate('/devices')}
      >
        <div className="w-7 h-7 rounded-lg bg-[var(--brand)] flex items-center justify-center shadow-sm">
          <Zap size={14} className="text-white" fill="white" />
        </div>
        <div>
          <span className="text-[13px] font-bold text-[var(--text)] tracking-tight">newSCADA</span>
          <span className="text-[10px] text-[var(--text-secondary)] ml-1.5">Editor</span>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1 flex-1 max-w-lg">
        {NAV_ITEMS.map(item => {
          const Icon   = item.icon
          const active = isActive(item.path)
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'relative flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-colors duration-150',
                active
                  ? 'text-[var(--brand)] bg-[var(--brand-bg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]',
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon size={13} />
              <span>{item.label}</span>

              {/* Active underline */}
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[var(--brand)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Dispatcher link */}
        <motion.a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-all"
          whileHover={{ scale: 1.02 }}
        >
          <Network size={12} />
          Dispatcher
        </motion.a>

        {/* Theme toggle */}
        <motion.button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0,   opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.header>
  )
}
