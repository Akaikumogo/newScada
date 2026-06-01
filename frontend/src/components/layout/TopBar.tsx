import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { DatabaseZap, Zap, Moon, Sun, Wifi, WifiOff, Loader2, GitCompare } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useDispatcherStore } from '@/store/dispatcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Branch, Substation } from '@/types'

// ── WS connection indicator ───────────────────────
function WsIndicator() {
  const wsState = useDispatcherStore(s => s.wsState)

  const cfg = {
    connected:    { icon: Wifi,    label: 'Live',         color: 'text-[#00D68F]', spin: false },
    connecting:   { icon: Loader2, label: 'Ulanmoqda',    color: 'text-[#FFAA00]', spin: true  },
    disconnected: { icon: WifiOff, label: 'Uzilgan',      color: 'text-[#FF3D71]', spin: false },
  }[wsState]

  const Icon = cfg.icon

  return (
    <Badge
      variant={wsState === 'connected' ? 'online' : wsState === 'connecting' ? 'warning' : 'offline'}
      className="gap-1.5 px-3 py-1.5"
    >
      <span className="relative flex items-center justify-center">
        <Icon size={12} className={`${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`} />
        {wsState === 'connected' && (
          <motion.span
            className="absolute w-3 h-3 rounded-full bg-[#00D68F]/30"
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={wsState}
          className={`text-[11px] font-medium ${cfg.color}`}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 3 }}
          transition={{ duration: 0.18 }}
        >
          {cfg.label}
        </motion.span>
      </AnimatePresence>
    </Badge>
  )
}

// ── Main TopBar ───────────────────────────────────
interface Props {
  branches:       Branch[]
  substations:    Substation[]
  onBranchChange: (id: number) => void
}

export function TopBar({ branches, substations, onBranchChange }: Props) {
  const navigate         = useNavigate()
  const { theme, toggle} = useTheme()
  const selectedBranchId = useDispatcherStore(s => s.selectedBranchId)
  const statuses         = useDispatcherStore(s => s.statuses)
  const selectSubstation = useDispatcherStore(s => s.selectSubstation)

  // Online / total count across ALL devices in store
  const onlineCount = Object.values(statuses).filter(s => s.status === 'online').length
  const totalCount  = Object.keys(statuses).length

  function handleBranchChange(id: number) {
    onBranchChange(id)
    // Will auto-navigate when substations load (useAutoSelect handles it)
  }

  return (
    <motion.header
      className="
        fixed top-0 left-0 right-0 z-50 h-14
        flex items-center justify-between px-4 gap-4
        bg-[var(--bg-elevated)] backdrop-blur-xl
        border-b border-[var(--border)]
        shadow-[0_8px_28px_rgba(0,0,0,0.18)]
      "
      initial={{ y: -14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ── Logo ��─────────────────────────────────── */}
      <motion.div
        className="flex items-center gap-2 flex-shrink-0 cursor-pointer"
        onClick={() => navigate('/')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--electric)] to-[#1554B8] flex items-center justify-center shadow-[0_0_14px_rgba(47,125,246,0.34)]">
          <Zap size={16} className="text-white" fill="white" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-bold text-[var(--text)] tracking-tight">newSCADA</div>
          <div className="text-[10px] text-ink-300 -mt-0.5">Dispatcher</div>
        </div>
      </motion.div>

      {/* ── Branch selector ───────────────────────── */}
      <div className="flex items-center gap-2">
        <select
          value={selectedBranchId ?? ''}
          onChange={e => handleBranchChange(Number(e.target.value))}
          className="
            h-8 px-3 rounded-xl text-[13px] font-medium
            bg-[var(--bg-card)] text-[var(--text)]
            border border-[var(--border)] hover:border-[var(--border-hover)]
            focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40
            cursor-pointer transition-all
          "
        >
          <option value="">Filial...</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Podstansiya quick jump */}
        {substations.length > 0 && (
          <select
            defaultValue=""
            onChange={e => {
              const id = Number(e.target.value)
              if (!id) return
              selectSubstation(id)
              navigate(`/substation/${id}`)
            }}
            className="
              h-8 px-3 rounded-xl text-[13px]
              bg-[var(--bg-card)] text-[var(--text)]
              border border-[var(--border)] hover:border-[var(--border-hover)]
              focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40
              cursor-pointer transition-all
            "
          >
            <option value="">Podstansiya...</option>
            {substations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Right section ─────────────────────────── */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Online/total counter */}
        {totalCount > 0 && (
          <Badge
            variant="online"
            className="gap-1.5 px-3 py-1.5"
          >
            <motion.span
              key={onlineCount}
              className="text-[13px] font-mono font-semibold text-[#00D68F]"
              initial={{ scale: 1.3, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500 }}
            >
              {onlineCount}
            </motion.span>
            <span className="text-[11px] text-ink-300">/ {totalCount}</span>
            <Wifi size={11} className="text-[#00D68F]" />
          </Badge>
        )}

        {/* WS indicator */}
        <WsIndicator />

        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs text-ink-200"
        >
        <motion.button
          onClick={() => {
            const subId = useDispatcherStore.getState().selectedSubstationId
            navigate(subId ? `/substation/${subId}/diff` : '/diff')
          }}
          aria-label="Signal diff sahifasini ochish"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          title="Tanlangan PS ichidagi qurilmalarni taqqoslash"
        >
          <GitCompare size={13} />
          Diff
        </motion.button>
        </Button>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs text-ink-200"
        >
        <motion.button
          onClick={() => navigate('/realtime')}
          aria-label="Redis realtime sahifasini ochish"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
        >
          <DatabaseZap size={13} />
          Redis
        </motion.button>
        </Button>

        {/* Theme toggle */}
        <Button
          asChild
          variant="outline"
          size="compactIcon"
          className="text-ink-200"
        >
        <motion.button
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Light theme yoqish' : 'Dark theme yoqish'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
              animate={{ rotate: 0,   opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18 }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        </Button>
      </div>
    </motion.header>
  )
}
