import { } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Substation } from '@/types'

// ── Substation item ───────────────────────────────
function SubstationItem({
  sub, isActive, onClick,
  onlineCount, offlineCount, totalCount,
}: {
  sub: Substation
  isActive: boolean
  onClick: () => void
  onlineCount: number
  offlineCount: number
  totalCount: number
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left
        transition-colors duration-150 group relative
        ${isActive
          ? 'bg-[var(--electric)]/10'
          : 'hover:bg-[var(--bg-subtle)]/50'
        }
      `}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bar"
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--electric)]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Icon */}
      <div className={`
        w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
        ${isActive ? 'bg-[var(--electric)]/20' : 'bg-[var(--bg-subtle)] group-hover:bg-[var(--bg-subtle)]'}
      `}>
        <Building2 size={13} className={isActive ? 'text-[var(--electric)]' : 'text-ink-300'} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-medium truncate leading-tight ${
          isActive ? 'text-[var(--electric-light)]' : 'text-ink-200'
        }`}>
          {sub.name}
        </div>

        {/* Online/offline counts */}
        {totalCount > 0 ? (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <Wifi size={9} className="text-[#00D68F]" />
              <span className="text-[10px] font-mono text-[#00D68F]">{onlineCount}</span>
            </div>
            {offlineCount > 0 && (
              <div className="flex items-center gap-1">
                <WifiOff size={9} className="text-[#FF3D71]" />
                <span className="text-[10px] font-mono text-[#FF3D71]">{offlineCount}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-ink-300/50 mt-0.5">Ma'lumot kutilmoqda</div>
        )}
      </div>

      <ChevronRight
        size={13}
        className={`flex-shrink-0 transition-all duration-200 ${
          isActive ? 'text-[var(--electric)]/60 opacity-100' : 'opacity-0 group-hover:opacity-40 text-ink-300'
        }`}
      />
    </motion.button>
  )
}

// ── Main Sidebar ─────────────────────────────────
export function Sidebar({ substations }: { substations: Substation[]; devices: Record<number, any> }) {
  const navigate       = useNavigate()
  const location       = useLocation()
  const statuses       = useDispatcherStore(s => s.statuses)
  const selectedId     = useDispatcherStore(s => s.selectedSubstationId)
  const selectSubstation = useDispatcherStore(s => s.selectSubstation)

  // Per-substation stats are shown in SubstationPage; sidebar just shows name + active state
  void statuses  // referenced by selectSubstation refresh

  function handleSelect(sub: Substation) {
    selectSubstation(sub.id)
    navigate(`/substation/${sub.id}`)
  }

  // Extract active substation id from URL
  const urlSubId = (() => {
    const m = location.pathname.match(/\/substation\/(\d+)/)
    return m ? Number(m[1]) : null
  })()

  const activeId = urlSubId ?? selectedId

  return (
    <motion.aside
      className="
        fixed top-14 left-0 bottom-0 w-[240px] z-40
        bg-[var(--bg-elevated)]/90 backdrop-blur-xl
        border-r border-[var(--border)]
        flex flex-col
      "
      initial={{ x: -240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Substation list */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {/* Section label */}
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-300/60">
          Podstansiyalar
        </div>

        <AnimatePresence initial={false}>
          {substations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-6 text-center text-[12px] text-ink-300"
            >
              <div className="text-2xl mb-2 opacity-30">📡</div>
              Filial tanlang
            </motion.div>
          ) : (
            substations.map((sub, i) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
              >
                <SubstationItem
                  sub={sub}
                  isActive={activeId === sub.id}
                  onClick={() => handleSelect(sub)}
                  onlineCount={0}
                  offlineCount={0}
                  totalCount={0}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="text-[10px] text-ink-300/40 text-center">
          newSCADA Dispatcher v0.1
        </div>
      </div>
    </motion.aside>
  )
}
